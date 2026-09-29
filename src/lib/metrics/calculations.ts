/**
 * Pure metric calculations. No I/O, no dates-from-the-clock: everything here
 * is deterministic and unit-tested.
 *
 * Convention: `null` means "unknown / not provided by the source". A null is
 * never silently treated as 0 in a ratio — ratios with unknown inputs are null.
 */
import type { AccountDailyMetrics, Confidence, PostMetrics } from "@/lib/domain/types";

export function sumNullable(values: (number | null | undefined)[]): number | null {
  let seen = false;
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    seen = true;
    total += v;
  }
  return seen ? total : null;
}

export function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Interactions = likes + comments + shares + saves.
 * Documented definition (DECISIONS.md D-009). Returns null only if every
 * component is unknown.
 */
export function interactions(m: Pick<PostMetrics, "likes" | "comments" | "shares" | "saves">): number | null {
  return sumNullable([m.likes, m.comments, m.shares, m.saves]);
}

/** Engagement rate = interactions / reach. */
export function engagementRate(m: Pick<PostMetrics, "likes" | "comments" | "shares" | "saves" | "reach">): number | null {
  return safeRatio(interactions(m), m.reach);
}

/** Normalised "per 1,000 accounts reached" rate — comparable across posts of different reach. */
export function per1kReach(value: number | null, reach: number | null): number | null {
  const r = safeRatio(value, reach);
  return r === null ? null : r * 1000;
}

/** Relative change (0.25 = +25%). Null when the previous value is unknown or 0. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function nonNull<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((v): v is T => v !== null && v !== undefined);
}

/**
 * Sample-size → confidence label. Deliberately conservative: patterns from
 * fewer than 5 posts are never reported as findings. See DECISIONS.md D-010.
 */
export function confidenceFromSampleSize(n: number): Confidence {
  if (n < 5) return "insufficient";
  if (n < 12) return "low";
  if (n < 30) return "medium";
  return "high";
}

export interface AccountTotals {
  days: number;
  daysWithData: number;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followsGained: number | null;
  unfollows: number | null;
  profileVisits: number | null;
  /** Followers at the last day with data in the range. */
  followersEnd: number | null;
  /** Followers at the first day with data in the range. */
  followersStart: number | null;
  netFollowerChange: number | null;
  interactions: number | null;
  /** interactions / reach over the period. */
  engagementRate: number | null;
}

/**
 * Aggregates daily account metrics. Note: summing daily `reach` gives
 * "sum of daily reach", NOT unique accounts reached over the period — the
 * API exposes unique period reach separately. The UI labels it accordingly.
 */
export function aggregateAccountDays(days: AccountDailyMetrics[]): AccountTotals {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const withFollowers = sorted.filter((d) => d.followers !== null);
  const followersStart = withFollowers[0]?.followers ?? null;
  const followersEnd = withFollowers[withFollowers.length - 1]?.followers ?? null;

  const reach = sumNullable(sorted.map((d) => d.reach));
  const likes = sumNullable(sorted.map((d) => d.likes));
  const comments = sumNullable(sorted.map((d) => d.comments));
  const shares = sumNullable(sorted.map((d) => d.shares));
  const saves = sumNullable(sorted.map((d) => d.saves));
  const inter = sumNullable([likes, comments, shares, saves]);

  return {
    days: sorted.length,
    daysWithData: sorted.filter((d) => d.reach !== null || d.views !== null).length,
    reach,
    views: sumNullable(sorted.map((d) => d.views)),
    likes,
    comments,
    shares,
    saves,
    followsGained: sumNullable(sorted.map((d) => d.followsGained)),
    unfollows: sumNullable(sorted.map((d) => d.unfollows)),
    profileVisits: sumNullable(sorted.map((d) => d.profileVisits)),
    followersStart,
    followersEnd,
    netFollowerChange:
      followersStart !== null && followersEnd !== null ? followersEnd - followersStart : null,
    interactions: inter,
    engagementRate: safeRatio(inter, reach),
  };
}

/** Derived per-post rates used for ranking and pattern detection. */
export interface PostRates {
  interactions: number | null;
  engagementRate: number | null;
  sharesPer1k: number | null;
  savesPer1k: number | null;
  followsPer1k: number | null;
  commentsPer1k: number | null;
}

export function postRates(m: PostMetrics): PostRates {
  return {
    interactions: interactions(m),
    engagementRate: engagementRate(m),
    sharesPer1k: per1kReach(m.shares, m.reach),
    savesPer1k: per1kReach(m.saves, m.reach),
    followsPer1k: per1kReach(m.follows, m.reach),
    commentsPer1k: per1kReach(m.comments, m.reach),
  };
}
