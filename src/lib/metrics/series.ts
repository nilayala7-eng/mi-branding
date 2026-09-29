/**
 * Builds aligned current-vs-previous series for charts. Day i of the current
 * period is paired with day i of the equivalent previous period. Long ranges
 * are bucketed by week so the chart shows trend, not daily noise.
 */
import type { AccountDailyMetrics } from "@/lib/domain/types";
import { safeRatio, sumNullable } from "./calculations";

export type SeriesMetric =
  | "reach"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "followsGained"
  | "followers"
  | "engagementRate";

export interface AlignedPoint {
  date: string;
  previousDate: string | null;
  current: number | null;
  previous: number | null;
}

function bucketValue(days: AccountDailyMetrics[], metric: SeriesMetric): number | null {
  if (days.length === 0) return null;
  if (metric === "followers") {
    // Stock metric: last known value in the bucket.
    for (let i = days.length - 1; i >= 0; i--) if (days[i].followers !== null) return days[i].followers;
    return null;
  }
  if (metric === "engagementRate") {
    const inter = sumNullable(days.flatMap((d) => [d.likes, d.comments, d.shares, d.saves]));
    return safeRatio(inter, sumNullable(days.map((d) => d.reach)));
  }
  return sumNullable(days.map((d) => d[metric]));
}

export function bucketSize(days: number): number {
  if (days > 200) return 7;
  if (days > 100) return 3;
  return 1;
}

export function alignSeries(
  current: AccountDailyMetrics[],
  previous: AccountDailyMetrics[],
  metric: SeriesMetric,
  size = bucketSize(current.length),
): AlignedPoint[] {
  const out: AlignedPoint[] = [];
  for (let i = 0; i < current.length; i += size) {
    const cur = current.slice(i, i + size);
    const prev = previous.slice(i, i + size);
    out.push({
      date: cur[0].date,
      previousDate: prev[0]?.date ?? null,
      current: bucketValue(cur, metric),
      previous: bucketValue(prev, metric),
    });
  }
  return out;
}
