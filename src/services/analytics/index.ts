/**
 * Analytics service — the business-intelligence layer. UI pages, the Claude
 * tools and the MCP server all call these functions; none of them talk to the
 * data source directly. Everything takes a `DataRepository` so it is testable.
 */
import type { DataRepository, PostFilter, PostSortKey } from "@/lib/data/repository";
import { eachDay, previousPeriod, rangeLength, type DateRange } from "@/lib/domain/periods";
import type { AccountDailyMetrics, Confidence, Post, TaxonomyDimensionKey } from "@/lib/domain/types";
import {
  aggregateAccountDays,
  confidenceFromSampleSize,
  median,
  nonNull,
  pctChange,
  postRates,
  type AccountTotals,
} from "@/lib/metrics/calculations";

export interface AccountMetrics {
  range: DateRange;
  totals: AccountTotals;
  /** One entry per calendar day in range; missing days are explicit nulls. */
  series: AccountDailyMetrics[];
}

export async function getAccountMetrics(repo: DataRepository, range: DateRange): Promise<AccountMetrics> {
  const days = await repo.getAccountDays(range);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const series = eachDay(range).map(
    (date) =>
      byDate.get(date) ?? {
        date,
        followers: null,
        followsGained: null,
        unfollows: null,
        reach: null,
        views: null,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        profileVisits: null,
      },
  );
  return { range, totals: aggregateAccountDays(days), series };
}

export type ComparableMetric = Exclude<
  keyof AccountTotals,
  "days" | "daysWithData" | "followersStart"
>;

export interface PeriodComparison {
  current: { range: DateRange; totals: AccountTotals; postCount: number };
  previous: { range: DateRange; totals: AccountTotals; postCount: number };
  /** Relative change per metric (0.1 = +10%). Null when not computable. */
  change: Record<ComparableMetric, number | null>;
  caveats: string[];
}

const COMPARABLE: ComparableMetric[] = [
  "reach",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followsGained",
  "unfollows",
  "profileVisits",
  "followersEnd",
  "netFollowerChange",
  "interactions",
  "engagementRate",
];

/**
 * Compares `range` with the equivalent previous period (same length,
 * immediately before), or with an explicit `against` range of equal length.
 */
export async function comparePeriods(
  repo: DataRepository,
  range: DateRange,
  against?: DateRange,
): Promise<PeriodComparison> {
  const prevRange = against ?? previousPeriod(range);
  if (rangeLength(prevRange) !== rangeLength(range)) {
    throw new RangeError("Periods must have the same number of days to be compared.");
  }
  const [curDays, prevDays, curPosts, prevPosts] = await Promise.all([
    repo.getAccountDays(range),
    repo.getAccountDays(prevRange),
    repo.getPosts({ range }),
    repo.getPosts({ range: prevRange }),
  ]);
  const current = aggregateAccountDays(curDays);
  const previous = aggregateAccountDays(prevDays);

  const change = Object.fromEntries(
    COMPARABLE.map((k) => [k, pctChange(current[k], previous[k])]),
  ) as Record<ComparableMetric, number | null>;

  // Compare against calendar length, not returned rows: missing days are
  // simply absent from the repository result.
  const caveats: string[] = [];
  const expectedDays = rangeLength(range);
  if (previous.daysWithData < expectedDays) {
    caveats.push(
      `El periodo anterior solo tiene datos en ${previous.daysWithData} de ${expectedDays} días; la comparación es parcial.`,
    );
  }
  if (current.daysWithData < expectedDays) {
    caveats.push(`El periodo actual solo tiene datos en ${current.daysWithData} de ${expectedDays} días.`);
  }
  if (curPosts.length !== prevPosts.length) {
    caveats.push(
      `Número de publicaciones distinto (${curPosts.length} vs ${prevPosts.length}); parte de la diferencia puede deberse al volumen, no al rendimiento.`,
    );
  }

  return {
    current: { range, totals: current, postCount: curPosts.length },
    previous: { range: prevRange, totals: previous, postCount: prevPosts.length },
    change,
    caveats,
  };
}

export interface PostWithRates extends Post {
  rates: ReturnType<typeof postRates>;
}

export function withRates(post: Post): PostWithRates {
  return { ...post, rates: postRates(post.metrics) };
}

export async function getPostMetrics(repo: DataRepository, filter: PostFilter = {}): Promise<PostWithRates[]> {
  return (await repo.getPosts(filter)).map(withRates);
}

export async function getTopPosts(
  repo: DataRepository,
  range: DateRange,
  by: PostSortKey = "sharesPer1k",
  limit = 5,
  opts: { minReach?: number } = {},
): Promise<PostWithRates[]> {
  // Rate-based rankings ignore tiny-reach posts, where one share swings the rate.
  const isRate = by.endsWith("Per1k") || by === "engagementRate";
  const minReach = opts.minReach ?? (isRate ? 300 : 0);
  const posts = await repo.getPosts({ range, sort: by, order: "desc" });
  return posts
    .filter((p) => (p.metrics.reach ?? 0) >= minReach)
    .slice(0, limit)
    .map(withRates);
}

export interface GroupStats {
  slug: string;
  label: string;
  n: number;
  confidence: Confidence;
  medianViews: number | null;
  medianReach: number | null;
  medianEngagementRate: number | null;
  medianSharesPer1k: number | null;
  medianSavesPer1k: number | null;
  medianFollowsPer1k: number | null;
}

export interface DimensionBreakdown {
  dimension: TaxonomyDimensionKey;
  range: DateRange;
  totalPosts: number;
  untaggedPosts: number;
  baseline: Omit<GroupStats, "slug" | "label">;
  groups: GroupStats[];
}

function groupStats(posts: Post[]): Omit<GroupStats, "slug" | "label"> {
  const rates = posts.map((p) => postRates(p.metrics));
  return {
    n: posts.length,
    confidence: confidenceFromSampleSize(posts.length),
    medianViews: median(nonNull(posts.map((p) => p.metrics.views))),
    medianReach: median(nonNull(posts.map((p) => p.metrics.reach))),
    medianEngagementRate: median(nonNull(rates.map((r) => r.engagementRate))),
    medianSharesPer1k: median(nonNull(rates.map((r) => r.sharesPer1k))),
    medianSavesPer1k: median(nonNull(rates.map((r) => r.savesPer1k))),
    medianFollowsPer1k: median(nonNull(rates.map((r) => r.followsPer1k))),
  };
}

/** Medians per taxonomy value. Medians, not means: one viral post must not define a group. */
export async function getContentByDimension(
  repo: DataRepository,
  dimension: TaxonomyDimensionKey,
  range: DateRange,
  filter: Omit<PostFilter, "range" | "tag"> = {},
): Promise<DimensionBreakdown> {
  const posts = await repo.getPosts({ ...filter, range });
  const buckets = new Map<string, { label: string; posts: Post[] }>();
  let untagged = 0;
  for (const p of posts) {
    const tags = p.tags.filter((t) => t.dimension === dimension);
    if (tags.length === 0) untagged++;
    for (const t of tags) {
      const b = buckets.get(t.slug) ?? { label: t.label, posts: [] };
      b.posts.push(p);
      buckets.set(t.slug, b);
    }
  }
  const groups = [...buckets.entries()]
    .map(([slug, b]) => ({ slug, label: b.label, ...groupStats(b.posts) }))
    .sort((a, b) => b.n - a.n);
  return {
    dimension,
    range,
    totalPosts: posts.length,
    untaggedPosts: untagged,
    baseline: groupStats(posts),
    groups,
  };
}

export const getContentByTopic = (repo: DataRepository, range: DateRange) =>
  getContentByDimension(repo, "topic", range);
export const getContentByHook = (repo: DataRepository, range: DateRange) =>
  getContentByDimension(repo, "hook", range);
export const getContentByCTA = (repo: DataRepository, range: DateRange) =>
  getContentByDimension(repo, "cta", range);
