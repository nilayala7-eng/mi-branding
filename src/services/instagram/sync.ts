/**
 * Instagram sync engine — source-agnostic and idempotent.
 *
 * It does not know about HTTP or Meta endpoints: it pulls from an
 * `InstagramSource` (the Meta Graph adapter in Phase 2, a fake in tests) and
 * writes through a `SyncStore` (Supabase in Phase 2, in-memory in tests).
 *
 * Idempotency keys:
 *  - posts:               (account_id, ig_media_id)
 *  - post insight rows:   (post_id, captured_on)      → one snapshot per day
 *  - account daily rows:  (account_id, date)
 * Re-running a sync updates rows in place; it never duplicates them.
 */
import type { AccountDailyMetrics, ISODate, ISODateTime, MediaType, PostMetrics } from "@/lib/domain/types";

export interface SourceMedia {
  igMediaId: string;
  mediaType: MediaType;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: ISODateTime;
  durationSec: number | null;
  /** Counts from the media object itself; fallback when insights are missing. */
  likeCount?: number | null;
  commentsCount?: number | null;
}

/** Snapshot metrics plus any extra raw metrics the source returned. */
export type SnapshotMetrics = Partial<PostMetrics> & { extra?: Record<string, number | null> };
export type SourceAccountDay = AccountDailyMetrics & { extra?: Record<string, number | null> };

export interface InstagramSource {
  listMedia(opts: { since?: ISODateTime }): Promise<SourceMedia[]>;
  getMediaInsights(media: SourceMedia): Promise<SnapshotMetrics>;
  getAccountDays(range: { from: ISODate; to: ISODate }): Promise<SourceAccountDay[]>;
}

export interface SyncRunRecord {
  id: string;
  accountId: string;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  status: "running" | "success" | "partial" | "failed" | "skipped";
  postsCreated: number;
  postsUpdated: number;
  snapshotsWritten: number;
  accountDaysWritten: number;
  errors: SyncError[];
}

export interface SyncError {
  scope: "media_list" | "media_insights" | "account_insights" | "store";
  ref: string | null;
  message: string;
}

export interface SyncStore {
  acquireLock(accountId: string, now: ISODateTime): Promise<boolean>;
  releaseLock(accountId: string): Promise<void>;
  startRun(accountId: string, now: ISODateTime): Promise<string>;
  finishRun(runId: string, record: Omit<SyncRunRecord, "id" | "accountId" | "startedAt">): Promise<void>;
  lastSuccessfulSync(accountId: string): Promise<ISODateTime | null>;
  upsertPost(accountId: string, media: SourceMedia): Promise<{ postId: string; created: boolean }>;
  upsertPostSnapshot(postId: string, capturedOn: ISODate, metrics: SnapshotMetrics): Promise<void>;
  upsertAccountDays(accountId: string, days: SourceAccountDay[]): Promise<number>;
}

export interface SyncOptions {
  accountId: string;
  now: ISODateTime;
  /** Days of account-level history to (re)fetch each run. */
  accountLookbackDays: number;
  /**
   * Posts younger than this keep getting fresh insight snapshots; older posts
   * are refreshed only on a full sync. Metrics settle after a few weeks.
   */
  refreshPostsNewerThanDays: number;
  full?: boolean;
}

/** Redact anything token-like before an error message is stored or logged. */
export function redact(message: string): string {
  return message
    .replace(/access_token=[^&\s"']+/gi, "access_token=[REDACTED]")
    .replace(/\b(IG|EA)[A-Za-z0-9]{30,}\b/g, "[REDACTED_TOKEN]");
}

const errMsg = (e: unknown) => redact(e instanceof Error ? e.message : String(e));

export async function runSync(source: InstagramSource, store: SyncStore, opts: SyncOptions): Promise<SyncRunRecord> {
  const { accountId, now } = opts;
  const startedAt = now;
  if (!(await store.acquireLock(accountId, now))) {
    return {
      id: "skipped",
      accountId,
      startedAt,
      finishedAt: now,
      status: "skipped",
      postsCreated: 0,
      postsUpdated: 0,
      snapshotsWritten: 0,
      accountDaysWritten: 0,
      errors: [{ scope: "store", ref: null, message: "Another sync is already running for this account." }],
    };
  }

  const runId = await store.startRun(accountId, now);
  const errors: SyncError[] = [];
  let postsCreated = 0;
  let postsUpdated = 0;
  let snapshotsWritten = 0;
  let accountDaysWritten = 0;
  let fatal = false;
  const today = now.slice(0, 10);

  try {
    // 1) Media list (always full list — cheap, and catches edited captions).
    let media: SourceMedia[] = [];
    try {
      media = await source.listMedia({});
    } catch (e) {
      errors.push({ scope: "media_list", ref: null, message: errMsg(e) });
      fatal = true;
    }

    // De-duplicate defensively: pagination bugs must not create duplicates.
    const unique = new Map(media.map((m) => [m.igMediaId, m]));
    const refreshCutoff = new Date(Date.parse(now) - opts.refreshPostsNewerThanDays * 86_400_000).toISOString();

    for (const m of unique.values()) {
      let postId: string;
      let created: boolean;
      try {
        ({ postId, created } = await store.upsertPost(accountId, m));
        if (created) postsCreated++;
        else postsUpdated++;
      } catch (e) {
        errors.push({ scope: "store", ref: m.igMediaId, message: errMsg(e) });
        continue;
      }
      // Old, already-known posts are only refreshed on a full sync. Posts seen
      // for the first time always get one snapshot (historical backfill).
      if (!opts.full && !created && m.publishedAt < refreshCutoff) continue;
      try {
        const metrics = await source.getMediaInsights(m);
        await store.upsertPostSnapshot(postId, today, metrics);
        snapshotsWritten++;
      } catch (e) {
        errors.push({ scope: "media_insights", ref: m.igMediaId, message: errMsg(e) });
      }
    }

    // 2) Account-level daily metrics.
    try {
      const from = new Date(Date.parse(`${today}T00:00:00Z`) - (opts.accountLookbackDays - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const days = await source.getAccountDays({ from, to: today });
      accountDaysWritten = await store.upsertAccountDays(accountId, days);
    } catch (e) {
      errors.push({ scope: "account_insights", ref: null, message: errMsg(e) });
    }
  } catch (e) {
    // Unexpected failure (e.g. a bug): still recorded, lock still released.
    errors.push({ scope: "store", ref: null, message: errMsg(e) });
    fatal = true;
  }

  const record: Omit<SyncRunRecord, "id" | "accountId" | "startedAt"> = {
    finishedAt: new Date().toISOString(),
    status: fatal ? "failed" : errors.length > 0 ? "partial" : "success",
    postsCreated,
    postsUpdated,
    snapshotsWritten,
    accountDaysWritten,
    errors,
  };
  try {
    await store.finishRun(runId, record);
  } finally {
    await store.releaseLock(accountId);
  }
  return { id: runId, accountId, startedAt, ...record };
}
