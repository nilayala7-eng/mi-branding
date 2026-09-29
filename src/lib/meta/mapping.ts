/**
 * Pure mapping between Instagram Graph API payloads and domain types.
 * Metric availability per media type follows the IG Media Insights reference
 * (verified 2026-09-29): `follows` and `profile_visits` exist for FEED and
 * STORY only — never for Reels.
 */
import type { AccountDailyMetrics, MediaType, PostMetrics } from "@/lib/domain/types";
import type { SourceMedia } from "@/services/instagram/sync";

export const MEDIA_FIELDS = "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

/**
 * With Instagram Login `media_product_type` is not available, so the type
 * comes from `media_type`. Video posts on Instagram are published as Reels,
 * so VIDEO → REEL (DECISIONS.md D-019).
 */
export function mapMediaType(t: string): MediaType {
  if (t === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (t === "VIDEO") return "REEL";
  return "IMAGE";
}

export function mapMedia(m: IgMedia): SourceMedia {
  const mediaType = mapMediaType(m.media_type);
  return {
    igMediaId: m.id,
    mediaType,
    caption: m.caption ?? "",
    permalink: m.permalink ?? null,
    // media_url is the image itself for IMAGE; for VIDEO use thumbnail_url.
    thumbnailUrl: m.thumbnail_url ?? (m.media_type === "IMAGE" ? m.media_url ?? null : null),
    publishedAt: new Date(m.timestamp).toISOString(),
    durationSec: null, // not exposed by the API
    likeCount: m.like_count ?? null,
    commentsCount: m.comments_count ?? null,
  };
}

const COMMON = ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"];

/** Metrics requested per media type (lifetime period is implicit). */
export function mediaMetricsFor(type: MediaType): string[] {
  if (type === "REEL") return [...COMMON, "ig_reels_avg_watch_time"];
  return [...COMMON, "follows", "profile_visits"];
}

/** Minimal set used as a fallback when a full request is rejected (e.g. very old media). */
export const FALLBACK_MEDIA_METRICS = ["reach", "likes", "comments", "saved", "shares"];

export interface InsightsResponse {
  data?: {
    name: string;
    values?: { value: unknown }[];
    total_value?: { value?: unknown; breakdowns?: { dimension_keys?: string[]; results?: { dimension_values: string[]; value: unknown }[] }[] };
  }[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** { metricName: number|null } from an insights response (values[0] or total_value). */
export function readInsightValues(res: InsightsResponse): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const d of res.data ?? []) out[d.name] = num(d.total_value?.value) ?? num(d.values?.[0]?.value);
  return out;
}

export function toPostMetrics(values: Record<string, number | null>, media: Pick<SourceMedia, "likeCount" | "commentsCount">): Partial<PostMetrics> & { extra: Record<string, number | null> } {
  const known = new Set(["views", "reach", "likes", "comments", "saved", "shares", "follows", "profile_visits"]);
  const extra: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(values)) if (!known.has(k)) extra[k] = v;
  return {
    views: values.views ?? null,
    reach: values.reach ?? null,
    likes: values.likes ?? media.likeCount ?? null,
    comments: values.comments ?? media.commentsCount ?? null,
    shares: values.shares ?? null,
    saves: values.saved ?? null,
    follows: values.follows ?? null,
    profileVisits: values.profile_visits ?? null,
    // Unit of ig_reels_avg_watch_time not documented → kept raw in `extra`.
    avgWatchTimeSec: null,
    extra,
  };
}

/** Account metrics requested per day with metric_type=total_value. */
export const ACCOUNT_DAY_METRICS = ["reach", "views", "likes", "comments", "shares", "saves", "total_interactions", "accounts_engaged"];

/**
 * follows_and_unfollows with breakdown=follow_type. Mapping FOLLOWER → new
 * follows and NON_FOLLOWER → unfollows is our reading of the docs; raw values
 * are kept in `extra` so it can be re-derived (META_SETUP.md, pending check).
 */
export function readFollowBreakdown(res: InsightsResponse): { follows: number | null; unfollows: number | null; raw: Record<string, number | null> } {
  const d = res.data?.find((x) => x.name === "follows_and_unfollows");
  const raw: Record<string, number | null> = {};
  for (const b of d?.total_value?.breakdowns ?? []) for (const r of b.results ?? []) raw[r.dimension_values.join("|")] = num(r.value);
  return { follows: raw.FOLLOWER ?? null, unfollows: raw.NON_FOLLOWER ?? null, raw };
}

export function toAccountDay(
  date: string,
  values: Record<string, number | null>,
  follow: { follows: number | null; unfollows: number | null },
  followers: number | null,
): AccountDailyMetrics & { extra: Record<string, number | null> } {
  return {
    date,
    followers,
    followsGained: follow.follows,
    unfollows: follow.unfollows,
    reach: values.reach ?? null,
    views: values.views ?? null,
    likes: values.likes ?? null,
    comments: values.comments ?? null,
    shares: values.shares ?? null,
    saves: values.saves ?? null,
    profileVisits: null, // no account-level profile views metric in the current API
    extra: { total_interactions: values.total_interactions ?? null, accounts_engaged: values.accounts_engaged ?? null },
  };
}

/** UTC instant of local midnight for `date` in `timeZone` (DST-safe). */
export function zonedMidnightUtc(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const offset = asUtc - guess;
    guess = Date.UTC(y, m - 1, d) - offset;
  }
  return new Date(guess);
}
