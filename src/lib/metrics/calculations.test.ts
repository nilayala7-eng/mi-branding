import { describe, expect, it } from "vitest";
import { makeDay } from "@/test/fixtures";
import {
  aggregateAccountDays,
  confidenceFromSampleSize,
  engagementRate,
  interactions,
  median,
  mean,
  pctChange,
  per1kReach,
  postRates,
  safeRatio,
  sumNullable,
} from "./calculations";

describe("sumNullable", () => {
  it("sums known values and ignores nulls", () => {
    expect(sumNullable([1, null, 2, undefined, 3])).toBe(6);
  });
  it("returns null when every value is unknown (never a fake 0)", () => {
    expect(sumNullable([null, undefined])).toBeNull();
    expect(sumNullable([])).toBeNull();
  });
  it("keeps real zeros", () => {
    expect(sumNullable([0, null])).toBe(0);
  });
});

describe("ratios", () => {
  it("safeRatio is null on unknown or zero denominators", () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(safeRatio(null, 10)).toBeNull();
    expect(safeRatio(5, null)).toBeNull();
    expect(safeRatio(5, 10)).toBe(0.5);
  });
  it("per1kReach normalises by reach", () => {
    expect(per1kReach(12, 4000)).toBe(3);
    expect(per1kReach(12, 0)).toBeNull();
  });
});

describe("interactions & engagement", () => {
  const m = { likes: 40, comments: 5, shares: 3, saves: 2, reach: 1000 };
  it("interactions = likes + comments + shares + saves", () => {
    expect(interactions(m)).toBe(50);
  });
  it("engagement rate = interactions / reach", () => {
    expect(engagementRate(m)).toBeCloseTo(0.05);
  });
  it("engagement rate is null without reach", () => {
    expect(engagementRate({ ...m, reach: null })).toBeNull();
  });
  it("partial metrics still count what is known", () => {
    expect(interactions({ likes: 10, comments: null, shares: null, saves: 1 })).toBe(11);
  });
  it("postRates computes every per-1k rate", () => {
    const r = postRates({ views: 2000, reach: 1000, likes: 40, comments: 5, shares: 3, saves: 2, follows: 1, profileVisits: null, avgWatchTimeSec: null });
    expect(r).toMatchObject({ sharesPer1k: 3, savesPer1k: 2, followsPer1k: 1, commentsPer1k: 5 });
  });
});

describe("pctChange", () => {
  it("computes relative change", () => {
    expect(pctChange(120, 100)).toBeCloseTo(0.2);
    expect(pctChange(80, 100)).toBeCloseTo(-0.2);
  });
  it("is null when the base is 0 or unknown", () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(10, null)).toBeNull();
    expect(pctChange(null, 10)).toBeNull();
  });
});

describe("median / mean", () => {
  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("median resists a viral outlier where the mean does not", () => {
    const values = [100, 110, 90, 105, 50_000];
    expect(median(values)).toBe(105);
    expect(mean(values)!).toBeGreaterThan(10_000);
  });
});

describe("confidenceFromSampleSize", () => {
  it("never reports confidence below 5 samples", () => {
    expect(confidenceFromSampleSize(0)).toBe("insufficient");
    expect(confidenceFromSampleSize(4)).toBe("insufficient");
    expect(confidenceFromSampleSize(5)).toBe("low");
    expect(confidenceFromSampleSize(12)).toBe("medium");
    expect(confidenceFromSampleSize(30)).toBe("high");
  });
});

describe("aggregateAccountDays", () => {
  it("sums flows and takes first/last known followers (unsorted input)", () => {
    const t = aggregateAccountDays([
      makeDay("2026-01-03", { followers: 1030, reach: 300 }),
      makeDay("2026-01-01", { followers: 1000, reach: 100 }),
      makeDay("2026-01-02", { followers: null, reach: 200 }),
    ]);
    expect(t.reach).toBe(600);
    expect(t.followersStart).toBe(1000);
    expect(t.followersEnd).toBe(1030);
    expect(t.netFollowerChange).toBe(30);
    expect(t.days).toBe(3);
  });
  it("engagement rate uses total interactions over total reach", () => {
    const t = aggregateAccountDays([
      makeDay("2026-01-01", { reach: 1000, likes: 50, comments: 10, shares: 20, saves: 20 }),
      makeDay("2026-01-02", { reach: 1000, likes: 0, comments: 0, shares: 0, saves: 0 }),
    ]);
    expect(t.interactions).toBe(100);
    expect(t.engagementRate).toBeCloseTo(0.05);
  });
  it("returns nulls for an empty period", () => {
    const t = aggregateAccountDays([]);
    expect(t.reach).toBeNull();
    expect(t.followersEnd).toBeNull();
    expect(t.engagementRate).toBeNull();
  });
});
