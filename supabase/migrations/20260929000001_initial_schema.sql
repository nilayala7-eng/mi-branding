-- Ayala OS — initial schema
-- PostgreSQL 15+ (Supabase). All timestamps are timestamptz (UTC).
-- Idempotency: every table fed by the Instagram sync has a natural unique key
-- so that re-running a sync upserts instead of duplicating.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- users — app users (maps 1:1 to auth.users when Supabase Auth is enabled)
-- ---------------------------------------------------------------------------
create table public.users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,               -- references auth.users(id) once Auth is on
  email        text unique,
  display_name text,
  timezone     text not null default 'Europe/Madrid',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- instagram_accounts — connected professional accounts + connection state.
-- Tokens are stored ENCRYPTED by the app (AES-256-GCM, APP_ENCRYPTION_KEY);
-- the database never sees a plaintext token. No passwords are ever stored.
-- ---------------------------------------------------------------------------
create table public.instagram_accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  ig_user_id            text not null,              -- Instagram-scoped user id from the API
  username              text not null,
  display_name          text,
  account_type          text,                       -- BUSINESS / MEDIA_CREATOR as returned by the API
  profile_picture_url   text,
  followers_count       integer,
  media_count           integer,
  access_token_encrypted text,
  token_expires_at      timestamptz,
  granted_scopes        text[] not null default '{}',
  connection_status     text not null default 'not_connected'
                        check (connection_status in ('not_connected','connected','token_expired','error')),
  last_sync_at          timestamptz,
  last_sync_status      text check (last_sync_status in ('success','partial','failed','skipped')),
  last_sync_error       text,
  sync_locked_until     timestamptz,                -- advisory lock for concurrent syncs
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (ig_user_id)
);
create index instagram_accounts_user_idx on public.instagram_accounts(user_id);
create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sync_runs — audit log of every sync (last sync, errors, counts)
-- ---------------------------------------------------------------------------
create table public.sync_runs (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.instagram_accounts(id) on delete cascade,
  kind                 text not null default 'incremental' check (kind in ('incremental','full','backfill')),
  status               text not null default 'running'
                       check (status in ('running','success','partial','failed','skipped')),
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  posts_created        integer not null default 0,
  posts_updated        integer not null default 0,
  snapshots_written    integer not null default 0,
  account_days_written integer not null default 0,
  errors               jsonb not null default '[]'::jsonb  -- [{scope, ref, message}] (tokens redacted)
);
create index sync_runs_account_started_idx on public.sync_runs(account_id, started_at desc);

-- ---------------------------------------------------------------------------
-- posts — one row per Instagram media object
-- ---------------------------------------------------------------------------
create table public.posts (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.instagram_accounts(id) on delete cascade,
  ig_media_id        text not null,
  media_type         text not null check (media_type in ('REEL','CAROUSEL','IMAGE','STORY')),
  media_product_type text,                  -- raw API value, kept for audit
  caption            text not null default '',
  permalink          text,
  thumbnail_url      text,                  -- CDN URL (expires)
  thumbnail_path     text,                  -- cached copy in Supabase Storage
  published_at       timestamptz not null,
  duration_sec       numeric,
  is_deleted         boolean not null default false,
  raw                jsonb,                 -- last raw API payload (debugging)
  first_seen_at      timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (account_id, ig_media_id)          -- sync idempotency key
);
create index posts_account_published_idx on public.posts(account_id, published_at desc);
create index posts_account_type_idx on public.posts(account_id, media_type);
create index posts_caption_search_idx on public.posts using gin (to_tsvector('spanish', caption));
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- post_insights — daily snapshots of per-post metrics (history over time).
-- NULL = metric not available from the API (never coerced to 0).
-- ---------------------------------------------------------------------------
create table public.post_insights (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.posts(id) on delete cascade,
  captured_on         date not null,        -- account-local day of the snapshot
  captured_at         timestamptz not null default now(),
  views               bigint,
  reach               bigint,
  likes               integer,
  comments            integer,
  shares              integer,
  saves               integer,
  follows             integer,
  profile_visits      integer,
  total_interactions  integer,
  avg_watch_time_sec  numeric,
  extra               jsonb not null default '{}'::jsonb, -- any other metric returned
  unique (post_id, captured_on)             -- one snapshot per post per day
);
create index post_insights_post_captured_idx on public.post_insights(post_id, captured_on desc);

-- Latest snapshot per post — what the app reads for "current" metrics.
-- security_invoker: the view obeys the caller's RLS instead of the owner's.
create view public.post_latest_insights with (security_invoker = true) as
  select distinct on (post_id) *
  from public.post_insights
  order by post_id, captured_on desc;

-- ---------------------------------------------------------------------------
-- account_insights — one row per account per day. Account-level history is
-- only retrievable from the API for a limited window, so we persist it.
-- ---------------------------------------------------------------------------
create table public.account_insights (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.instagram_accounts(id) on delete cascade,
  date           date not null,
  followers      integer,
  follows_gained integer,
  unfollows      integer,
  reach          bigint,
  views          bigint,
  likes          integer,
  comments       integer,
  shares         integer,
  saves          integer,
  profile_visits integer,
  extra          jsonb not null default '{}'::jsonb,
  captured_at    timestamptz not null default now(),
  unique (account_id, date)
);
create index account_insights_account_date_idx on public.account_insights(account_id, date desc);

-- ---------------------------------------------------------------------------
-- Content taxonomy — categories are DATA, editable without deploys.
-- ---------------------------------------------------------------------------
create table public.taxonomy_dimensions (
  key         text primary key,             -- topic, subtopic, hook, cta, format, visual_style, audio, …
  label       text not null,
  description text,
  sort_order  integer not null default 0
);

create table public.taxonomy_values (
  id          uuid primary key default gen_random_uuid(),
  dimension   text not null references public.taxonomy_dimensions(key) on update cascade,
  slug        text not null,
  label       text not null,
  parent_id   uuid references public.taxonomy_values(id) on delete set null, -- subtopic → topic
  description text,                          -- may contain "keywords: a, b" for the rule classifier
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (dimension, slug)
);
create trigger taxonomy_values_updated_at before update on public.taxonomy_values
  for each row execute function public.set_updated_at();

-- content_tags — post ↔ taxonomy value, with provenance.
create table public.content_tags (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  value_id    uuid not null references public.taxonomy_values(id) on delete cascade,
  dimension   text not null references public.taxonomy_dimensions(key) on update cascade,
  source      text not null check (source in ('manual','claude','rule')),
  confidence  numeric not null default 1 check (confidence between 0 and 1),
  model       text,                         -- classifier / model id for automatic tags
  rationale   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (post_id, dimension)               -- single-valued per dimension (DECISIONS D-011)
);
create index content_tags_value_idx on public.content_tags(value_id);
create index content_tags_dimension_idx on public.content_tags(dimension, value_id);
create trigger content_tags_updated_at before update on public.content_tags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- claude_analyses — persisted AI analyses with the data they were based on.
-- ---------------------------------------------------------------------------
create table public.claude_analyses (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.instagram_accounts(id) on delete cascade,
  kind           text not null check (kind in ('chat','period_review','classification','strategy')),
  question       text,
  answer         text,
  period_from    date,
  period_to      date,
  tool_calls     jsonb not null default '[]'::jsonb,  -- which tools/data supported the answer
  model          text not null,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz not null default now()
);
create index claude_analyses_account_created_idx on public.claude_analyses(account_id, created_at desc);

-- ---------------------------------------------------------------------------
-- strategy_recommendations — DATA / INTERPRETATION / HYPOTHESIS / RECOMMENDATION
-- ---------------------------------------------------------------------------
create table public.strategy_recommendations (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.instagram_accounts(id) on delete cascade,
  insight_key     text not null,                -- deterministic id, e.g. hook:tiempo:medianSharesPer1k
  kind            text not null check (kind in ('positive','negative','change','opportunity')),
  title           text not null,
  data            jsonb not null,               -- {statement, evidence[], sampleSize, period}
  interpretation  text not null,
  hypothesis      text,
  recommendation  text,
  confidence      text not null check (confidence in ('insufficient','low','medium','high')),
  caveats         text[] not null default '{}',
  source          text not null default 'rules' check (source in ('rules','claude')),
  analysis_id     uuid references public.claude_analyses(id) on delete set null,
  period_from     date not null,
  period_to       date not null,
  status          text not null default 'open' check (status in ('open','accepted','dismissed','tested')),
  created_at      timestamptz not null default now(),
  unique (account_id, insight_key, period_from, period_to)
);
create index strategy_recommendations_account_idx on public.strategy_recommendations(account_id, created_at desc);

-- ---------------------------------------------------------------------------
-- experiments & experiment_results
-- ---------------------------------------------------------------------------
create table public.experiments (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.instagram_accounts(id) on delete cascade,
  name                 text not null,
  hypothesis           text not null,
  metric               text not null,
  baseline             numeric,
  baseline_description text not null default '',
  test                 text not null,
  start_date           date not null,
  end_date             date not null,
  status               text not null default 'draft'
                       check (status in ('draft','running','completed','inconclusive','cancelled')),
  result               numeric,
  result_sample_size   integer,
  conclusion           text,
  recommendation_id    uuid references public.strategy_recommendations(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_date >= start_date)
);
create index experiments_account_status_idx on public.experiments(account_id, status);
create trigger experiments_updated_at before update on public.experiments
  for each row execute function public.set_updated_at();

-- Posts that belong to an experiment (test or control arm) and measured values.
create table public.experiment_results (
  id             uuid primary key default gen_random_uuid(),
  experiment_id  uuid not null references public.experiments(id) on delete cascade,
  post_id        uuid references public.posts(id) on delete set null,
  arm            text not null default 'test' check (arm in ('test','control')),
  metric_value   numeric,
  measured_at    timestamptz not null default now(),
  notes          text,
  unique (experiment_id, post_id)
);
create index experiment_results_experiment_idx on public.experiment_results(experiment_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled everywhere, no public policies. The app talks
-- to the DB server-side with the service role; the anon key can read nothing.
-- Per-user policies are added when Supabase Auth is enabled.
-- ---------------------------------------------------------------------------
alter table public.users                    enable row level security;
alter table public.instagram_accounts       enable row level security;
alter table public.sync_runs                enable row level security;
alter table public.posts                    enable row level security;
alter table public.post_insights            enable row level security;
alter table public.account_insights         enable row level security;
alter table public.taxonomy_dimensions      enable row level security;
alter table public.taxonomy_values          enable row level security;
alter table public.content_tags             enable row level security;
alter table public.claude_analyses          enable row level security;
alter table public.strategy_recommendations enable row level security;
alter table public.experiments              enable row level security;
alter table public.experiment_results       enable row level security;
