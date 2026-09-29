/**
 * DataRepository on Postgres (Supabase). Loads the single account's posts
 * with their latest insight snapshot and tags, then reuses the same pure
 * filterPosts() as the mock so both sources have identical semantics.
 */
import { getActiveAccount } from "@/lib/db/accounts";
import { toNum, type Sql } from "@/lib/db/client";
import type { DateRange } from "@/lib/domain/periods";
import type { AccountDailyMetrics, ContentTag, Experiment, MediaType, Post, TaxonomyDimensionKey, TaxonomyValue } from "@/lib/domain/types";
import { filterPosts, localDate } from "@/lib/metrics/filters";
import type { AccountSummary, DataRepository, ExperimentPatch, NewExperiment, PostFilter } from "../repository";

const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString());
const day = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export class PostgresRepository implements DataRepository {
  private accountCache: Promise<AccountSummary> | null = null;

  constructor(
    private readonly sql: Sql,
    private readonly timeZone: string,
  ) {}

  getAccount(): Promise<AccountSummary> {
    this.accountCache ??= (async () => {
      const a = await getActiveAccount(this.sql);
      const today = localDate(new Date().toISOString(), this.timeZone);
      return {
        id: a?.id ?? "none",
        username: a?.username ?? "ayala.fit_",
        displayName: a?.displayName ?? "Ayala Fitness",
        connectionStatus: a?.connectionStatus ?? "not_connected",
        lastSyncAt: a?.lastSyncAt ? a.lastSyncAt.toISOString() : null,
        lastSyncError: a?.lastSyncError ?? null,
        isMock: false,
        today,
      };
    })();
    return this.accountCache;
  }

  private async accountId(): Promise<string | null> {
    const a = await this.getAccount();
    return a.id === "none" ? null : a.id;
  }

  async getAccountDays(range: DateRange): Promise<AccountDailyMetrics[]> {
    const id = await this.accountId();
    if (!id) return [];
    const rows = await this.sql`
      select date, followers, follows_gained, unfollows, reach, views, likes, comments, shares, saves, profile_visits
      from account_insights where account_id = ${id} and date between ${range.from} and ${range.to} order by date`;
    return rows.map((r) => ({
      date: day(r.date),
      followers: toNum(r.followers),
      followsGained: toNum(r.follows_gained),
      unfollows: toNum(r.unfollows),
      reach: toNum(r.reach),
      views: toNum(r.views),
      likes: toNum(r.likes),
      comments: toNum(r.comments),
      shares: toNum(r.shares),
      saves: toNum(r.saves),
      profileVisits: toNum(r.profile_visits),
    }));
  }

  private async loadPosts(where: { id?: string } = {}): Promise<Post[]> {
    const accountId = await this.accountId();
    if (!accountId) return [];
    const rows = await this.sql`
      select p.id, p.account_id, p.ig_media_id, p.media_type, p.caption, p.permalink,
             coalesce(p.thumbnail_path, p.thumbnail_url) as thumb, p.published_at, p.duration_sec,
             i.views, i.reach, i.likes, i.comments, i.shares, i.saves, i.follows, i.profile_visits,
             i.avg_watch_time_sec, i.captured_at,
             coalesce((select json_agg(json_build_object('dimension', t.dimension, 'valueId', t.value_id, 'slug', v.slug,
                 'label', v.label, 'source', t.source, 'confidence', t.confidence))
               from content_tags t join taxonomy_values v on v.id = t.value_id where t.post_id = p.id), '[]') as tags
      from posts p
      left join post_latest_insights i on i.post_id = p.id
      where p.account_id = ${accountId} and not p.is_deleted ${where.id ? this.sql`and p.id = ${where.id}` : this.sql``}`;
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      igMediaId: r.ig_media_id,
      mediaType: r.media_type as MediaType,
      caption: r.caption,
      permalink: r.permalink,
      thumbnailUrl: r.thumb,
      publishedAt: iso(r.published_at)!,
      durationSec: toNum(r.duration_sec),
      metrics: {
        views: toNum(r.views),
        reach: toNum(r.reach),
        likes: toNum(r.likes),
        comments: toNum(r.comments),
        shares: toNum(r.shares),
        saves: toNum(r.saves),
        follows: toNum(r.follows),
        profileVisits: toNum(r.profile_visits),
        avgWatchTimeSec: toNum(r.avg_watch_time_sec),
      },
      metricsUpdatedAt: iso(r.captured_at),
      tags: (r.tags as ContentTag[]).map((t) => ({ ...t, confidence: Number(t.confidence) })),
    }));
  }

  async getPosts(filter: PostFilter = {}) {
    return filterPosts(await this.loadPosts(), filter, this.timeZone);
  }

  async getPost(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return (await this.loadPosts({ id }))[0] ?? null;
  }

  async getTaxonomy(): Promise<TaxonomyValue[]> {
    const rows = await this.sql`
      select id, dimension, slug, label, parent_id, description, active from taxonomy_values order by dimension, label`;
    return rows.map((r) => ({
      id: r.id,
      dimension: r.dimension,
      slug: r.slug,
      label: r.label,
      parentId: r.parent_id,
      description: r.description,
      active: r.active,
    }));
  }

  private mapExperiment = (r: Record<string, unknown>): Experiment => ({
    id: r.id as string,
    name: r.name as string,
    hypothesis: r.hypothesis as string,
    metric: r.metric as Experiment["metric"],
    baseline: toNum(r.baseline),
    baselineDescription: r.baseline_description as string,
    test: r.test as string,
    startDate: day(r.start_date as Date),
    endDate: day(r.end_date as Date),
    status: r.status as Experiment["status"],
    result: toNum(r.result),
    resultSampleSize: toNum(r.result_sample_size),
    conclusion: (r.conclusion as string | null) ?? null,
    createdAt: iso(r.created_at as Date)!,
  });

  async listExperiments() {
    const id = await this.accountId();
    if (!id) return [];
    const rows = await this.sql`select * from experiments where account_id = ${id} order by created_at desc`;
    return rows.map(this.mapExperiment);
  }

  async createExperiment(e: NewExperiment) {
    const id = await this.accountId();
    if (!id) throw new Error("Conecta Instagram antes de crear experimentos.");
    const [r] = await this.sql`
      insert into experiments (account_id, name, hypothesis, metric, baseline, baseline_description, test, start_date, end_date)
      values (${id}, ${e.name}, ${e.hypothesis}, ${e.metric}, ${e.baseline}, ${e.baselineDescription}, ${e.test}, ${e.startDate}, ${e.endDate})
      returning *`;
    return this.mapExperiment(r);
  }

  async updateExperiment(expId: string, patch: ExperimentPatch) {
    const cols: Record<string, unknown> = {};
    if (patch.status !== undefined) cols.status = patch.status;
    if (patch.result !== undefined) cols.result = patch.result;
    if (patch.resultSampleSize !== undefined) cols.result_sample_size = patch.resultSampleSize;
    if (patch.conclusion !== undefined) cols.conclusion = patch.conclusion;
    if (patch.endDate !== undefined) cols.end_date = patch.endDate;
    if (patch.test !== undefined) cols.test = patch.test;
    const accountId = await this.accountId();
    const rows = Object.keys(cols).length
      ? await this.sql`update experiments set ${this.sql(cols)} where id = ${expId} and account_id = ${accountId} returning *`
      : await this.sql`select * from experiments where id = ${expId} and account_id = ${accountId}`;
    if (!rows[0]) throw new Error(`Experiment ${expId} not found`);
    return this.mapExperiment(rows[0]);
  }

  /** Manual tagging: one tag per dimension; manual tags always win. */
  async setManualTag(postId: string, valueId: string) {
    if (!(await this.getPost(postId))) throw new Error("Post not found");
    await this.sql`
      insert into content_tags (post_id, value_id, dimension, source, confidence)
      select ${postId}, v.id, v.dimension, 'manual', 1 from taxonomy_values v where v.id = ${valueId}
      on conflict (post_id, dimension) do update set value_id = excluded.value_id, source = 'manual', confidence = 1,
        model = null, rationale = null`;
  }

  async removeTag(postId: string, dimension: TaxonomyDimensionKey) {
    await this.sql`delete from content_tags where post_id = ${postId} and dimension = ${dimension}`;
  }
}
