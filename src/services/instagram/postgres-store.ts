/**
 * SyncStore on Postgres. Same idempotency contract as InMemorySyncStore,
 * enforced by the unique constraints in the migration (ON CONFLICT upserts).
 */
import type { Sql } from "@/lib/db/client";
import type { ISODate, ISODateTime } from "@/lib/domain/types";
import type { SnapshotMetrics, SourceAccountDay, SourceMedia, SyncRunRecord, SyncStore } from "./sync";

const LOCK_MINUTES = 15;

export class PostgresSyncStore implements SyncStore {
  constructor(private readonly sql: Sql) {}

  async acquireLock(accountId: string): Promise<boolean> {
    const rows = await this.sql`
      update instagram_accounts set sync_locked_until = now() + ${`${LOCK_MINUTES} minutes`}::interval
      where id = ${accountId} and (sync_locked_until is null or sync_locked_until < now())
      returning id`;
    return rows.length === 1;
  }

  async releaseLock(accountId: string) {
    await this.sql`update instagram_accounts set sync_locked_until = null where id = ${accountId}`;
  }

  async startRun(accountId: string, now: ISODateTime) {
    const [r] = await this.sql<{ id: string }[]>`
      insert into sync_runs (account_id, started_at) values (${accountId}, ${now}) returning id`;
    return r.id;
  }

  async finishRun(runId: string, rec: Omit<SyncRunRecord, "id" | "accountId" | "startedAt">) {
    const errors = rec.errors.slice(0, 200);
    const [run] = await this.sql<{ account_id: string }[]>`
      update sync_runs set status = ${rec.status}, finished_at = ${rec.finishedAt}, posts_created = ${rec.postsCreated},
        posts_updated = ${rec.postsUpdated}, snapshots_written = ${rec.snapshotsWritten},
        account_days_written = ${rec.accountDaysWritten}, errors = ${this.sql.json(errors as never)}
      where id = ${runId} returning account_id`;
    const summary = errors.length ? `${errors.length} error(s): ${errors[0].message}`.slice(0, 500) : null;
    await this.sql`
      update instagram_accounts set last_sync_at = ${rec.finishedAt}, last_sync_status = ${rec.status}, last_sync_error = ${summary}
      where id = ${run.account_id}`;
  }

  async lastSuccessfulSync(accountId: string) {
    const [r] = await this.sql<{ finished_at: Date | null }[]>`
      select max(finished_at) as finished_at from sync_runs where account_id = ${accountId} and status in ('success','partial')`;
    return r?.finished_at ? r.finished_at.toISOString() : null;
  }

  async upsertPost(accountId: string, m: SourceMedia) {
    const [r] = await this.sql<{ id: string; created: boolean }[]>`
      insert into posts (account_id, ig_media_id, media_type, caption, permalink, thumbnail_url, published_at, duration_sec)
      values (${accountId}, ${m.igMediaId}, ${m.mediaType}, ${m.caption}, ${m.permalink}, ${m.thumbnailUrl}, ${m.publishedAt}, ${m.durationSec})
      on conflict (account_id, ig_media_id) do update set
        media_type = excluded.media_type, caption = excluded.caption, permalink = excluded.permalink,
        thumbnail_url = coalesce(excluded.thumbnail_url, posts.thumbnail_url), is_deleted = false
      returning id, (xmax = 0) as created`;
    return { postId: r.id, created: r.created };
  }

  async upsertPostSnapshot(postId: string, capturedOn: ISODate, m: SnapshotMetrics) {
    const v = (x: number | null | undefined) => (x === undefined ? null : x);
    await this.sql`
      insert into post_insights (post_id, captured_on, views, reach, likes, comments, shares, saves, follows,
        profile_visits, total_interactions, avg_watch_time_sec, extra)
      values (${postId}, ${capturedOn}, ${v(m.views)}, ${v(m.reach)}, ${v(m.likes)}, ${v(m.comments)}, ${v(m.shares)},
        ${v(m.saves)}, ${v(m.follows)}, ${v(m.profileVisits)}, ${v(m.extra?.total_interactions)}, ${v(m.avgWatchTimeSec)},
        ${this.sql.json((m.extra ?? {}) as never)})
      on conflict (post_id, captured_on) do update set
        captured_at = now(), views = excluded.views, reach = excluded.reach, likes = excluded.likes,
        comments = excluded.comments, shares = excluded.shares, saves = excluded.saves, follows = excluded.follows,
        profile_visits = excluded.profile_visits, total_interactions = excluded.total_interactions,
        avg_watch_time_sec = excluded.avg_watch_time_sec, extra = excluded.extra`;
  }

  async upsertAccountDays(accountId: string, days: SourceAccountDay[]) {
    for (const d of days) {
      // coalesce: a later sync without a value must not erase a known one
      // (e.g. followers is only known on the day it was captured).
      await this.sql`
        insert into account_insights (account_id, date, followers, follows_gained, unfollows, reach, views, likes,
          comments, shares, saves, profile_visits, extra)
        values (${accountId}, ${d.date}, ${d.followers}, ${d.followsGained}, ${d.unfollows}, ${d.reach}, ${d.views},
          ${d.likes}, ${d.comments}, ${d.shares}, ${d.saves}, ${d.profileVisits}, ${this.sql.json((d.extra ?? {}) as never)})
        on conflict (account_id, date) do update set
          followers = coalesce(excluded.followers, account_insights.followers),
          follows_gained = coalesce(excluded.follows_gained, account_insights.follows_gained),
          unfollows = coalesce(excluded.unfollows, account_insights.unfollows),
          reach = coalesce(excluded.reach, account_insights.reach),
          views = coalesce(excluded.views, account_insights.views),
          likes = coalesce(excluded.likes, account_insights.likes),
          comments = coalesce(excluded.comments, account_insights.comments),
          shares = coalesce(excluded.shares, account_insights.shares),
          saves = coalesce(excluded.saves, account_insights.saves),
          profile_visits = coalesce(excluded.profile_visits, account_insights.profile_visits),
          extra = account_insights.extra || excluded.extra,
          captured_at = now()`;
    }
    return days.length;
  }
}
