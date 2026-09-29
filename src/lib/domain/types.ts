/**
 * Core domain types for Ayala OS.
 *
 * These types are storage-agnostic: the mock repository, the Supabase
 * repository and the Instagram sync all speak this language. Anything that is
 * Meta-API specific lives in `src/lib/meta` and is mapped into these types.
 *
 * Metric names intentionally mirror the Instagram Graph API metric names where
 * a direct equivalent exists (views, reach, likes, comments, shares, saved,
 * follows, total_interactions). See META_SETUP.md for verification status.
 */

export type ISODate = string; // YYYY-MM-DD (account-local calendar day)
export type ISODateTime = string; // full ISO-8601 timestamp, UTC

export type MediaType = "REEL" | "CAROUSEL" | "IMAGE" | "STORY";

/** Per-post metrics. `null` means "not available from the source", never 0. */
export interface PostMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profileVisits: number | null;
  /** Average watch time in seconds (Reels only). */
  avgWatchTimeSec: number | null;
}

export interface Post {
  id: string;
  accountId: string;
  /** Instagram media id — the idempotency key for sync. */
  igMediaId: string;
  mediaType: MediaType;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: ISODateTime;
  /** Duration in seconds when known (video). Not guaranteed by the API. */
  durationSec: number | null;
  metrics: PostMetrics;
  /** Latest insight snapshot time. */
  metricsUpdatedAt: ISODateTime | null;
  tags: ContentTag[];
}

/** One day of account-level metrics. */
export interface AccountDailyMetrics {
  date: ISODate;
  followers: number | null;
  followsGained: number | null;
  unfollows: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profileVisits: number | null;
}

// ---------------------------------------------------------------------------
// Content taxonomy — data, not code. Dimensions and values live in the DB so
// they can evolve without deploys.
// ---------------------------------------------------------------------------

export type TaxonomyDimensionKey =
  | "topic"
  | "subtopic"
  | "hook"
  | "cta"
  | "format"
  | "visual_style"
  | "audio";

export interface TaxonomyValue {
  id: string;
  dimension: TaxonomyDimensionKey;
  slug: string;
  label: string;
  parentId: string | null;
  description: string | null;
  active: boolean;
}

export type TagSource = "manual" | "claude" | "rule";

export interface ContentTag {
  dimension: TaxonomyDimensionKey;
  valueId: string;
  slug: string;
  label: string;
  source: TagSource;
  /** 0..1 — manual tags are 1. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Strategy & experiments
// ---------------------------------------------------------------------------

export type Confidence = "insufficient" | "low" | "medium" | "high";

/**
 * Every insight separates DATA / INTERPRETATION / HYPOTHESIS / RECOMMENDATION.
 * Only `data` contains numbers, and every number there comes from the DB.
 */
export interface StrategyInsight {
  id: string;
  kind: "positive" | "negative" | "change" | "opportunity";
  title: string;
  data: {
    statement: string;
    evidence: { label: string; value: string }[];
    sampleSize: number;
    period: { from: ISODate; to: ISODate };
  };
  interpretation: string;
  hypothesis: string | null;
  recommendation: string | null;
  confidence: Confidence;
  caveats: string[];
}

export type ExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "inconclusive"
  | "cancelled";

export type ExperimentMetric =
  | "views"
  | "reach"
  | "shares"
  | "saves"
  | "follows"
  | "comments"
  | "likes"
  | "engagement_rate"
  | "shares_per_1k_reach"
  | "saves_per_1k_reach"
  | "follows_per_1k_reach";

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  metric: ExperimentMetric;
  /** Baseline value of the metric at creation (median of comparable posts). */
  baseline: number | null;
  baselineDescription: string;
  test: string;
  startDate: ISODate;
  endDate: ISODate;
  status: ExperimentStatus;
  result: number | null;
  resultSampleSize: number | null;
  conclusion: string | null;
  createdAt: ISODateTime;
}
