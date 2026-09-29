/**
 * Tables and columns Ayala OS expects in schema `public`. Used to generate the
 * safety guard in supabase/setup.sql and the read-only supabase/check.sql.
 * Must match supabase/migrations/*_initial_schema.sql — the Postgres
 * integration test fails if they drift apart.
 */
export const EXPECTED_TABLES: Record<string, string[]> = {
  users: ["id", "auth_user_id", "email", "display_name", "timezone", "created_at", "updated_at"],
  instagram_accounts: [
    "id", "user_id", "ig_user_id", "username", "display_name", "account_type", "profile_picture_url",
    "followers_count", "media_count", "access_token_encrypted", "token_expires_at", "granted_scopes",
    "connection_status", "last_sync_at", "last_sync_status", "last_sync_error", "sync_locked_until",
    "created_at", "updated_at",
  ],
  sync_runs: [
    "id", "account_id", "kind", "status", "started_at", "finished_at", "posts_created", "posts_updated",
    "snapshots_written", "account_days_written", "errors",
  ],
  posts: [
    "id", "account_id", "ig_media_id", "media_type", "media_product_type", "caption", "permalink",
    "thumbnail_url", "thumbnail_path", "published_at", "duration_sec", "is_deleted", "raw", "first_seen_at",
    "created_at", "updated_at",
  ],
  post_insights: [
    "id", "post_id", "captured_on", "captured_at", "views", "reach", "likes", "comments", "shares", "saves",
    "follows", "profile_visits", "total_interactions", "avg_watch_time_sec", "extra",
  ],
  account_insights: [
    "id", "account_id", "date", "followers", "follows_gained", "unfollows", "reach", "views", "likes",
    "comments", "shares", "saves", "profile_visits", "extra", "captured_at",
  ],
  taxonomy_dimensions: ["key", "label", "description", "sort_order"],
  taxonomy_values: ["id", "dimension", "slug", "label", "parent_id", "description", "active", "created_at", "updated_at"],
  content_tags: [
    "id", "post_id", "value_id", "dimension", "source", "confidence", "model", "rationale", "created_at", "updated_at",
  ],
  claude_analyses: [
    "id", "account_id", "kind", "question", "answer", "period_from", "period_to", "tool_calls", "model",
    "input_tokens", "output_tokens", "created_at",
  ],
  strategy_recommendations: [
    "id", "account_id", "insight_key", "kind", "title", "data", "interpretation", "hypothesis", "recommendation",
    "confidence", "caveats", "source", "analysis_id", "period_from", "period_to", "status", "created_at",
  ],
  experiments: [
    "id", "account_id", "name", "hypothesis", "metric", "baseline", "baseline_description", "test", "start_date",
    "end_date", "status", "result", "result_sample_size", "conclusion", "recommendation_id", "created_at", "updated_at",
  ],
  experiment_results: ["id", "experiment_id", "post_id", "arm", "metric_value", "measured_at", "notes"],
};

/** SQL `values` list: ('users', array['id', …]::text[]), … */
export function expectedTablesValuesSql(): string {
  return Object.entries(EXPECTED_TABLES)
    .map(([t, cols]) => `    ('${t}', array[${cols.map((c) => `'${c}'`).join(", ")}]::text[])`)
    .join(",\n");
}
