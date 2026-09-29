import { describe, expect, it } from "vitest";
import { eachDay } from "@/lib/domain/periods";
import { FixtureRepository, makeDay, makePost, tag } from "@/test/fixtures";
import { comparePeriods, getAccountMetrics, getContentByDimension, getTopPosts } from ".";

const days = [
  ...eachDay({ from: "2026-01-01", to: "2026-01-10" }).map((d) => makeDay(d, { reach: 100, followsGained: 2 })),
  ...eachDay({ from: "2026-01-11", to: "2026-01-20" }).map((d) => makeDay(d, { reach: 150, followsGained: 3 })),
];

describe("comparePeriods", () => {
  const repo = new FixtureRepository(
    [makePost({ publishedAt: "2026-01-05T10:00:00Z" }), makePost({ publishedAt: "2026-01-15T10:00:00Z" }), makePost({ publishedAt: "2026-01-16T10:00:00Z" })],
    days,
  );

  it("compares with the equivalent previous period", async () => {
    const c = await comparePeriods(repo, { from: "2026-01-11", to: "2026-01-20" });
    expect(c.previous.range).toEqual({ from: "2026-01-01", to: "2026-01-10" });
    expect(c.current.totals.reach).toBe(1500);
    expect(c.previous.totals.reach).toBe(1000);
    expect(c.change.reach).toBeCloseTo(0.5);
    expect(c.change.followsGained).toBeCloseTo(0.5);
  });

  it("flags different post volumes as a caveat", async () => {
    const c = await comparePeriods(repo, { from: "2026-01-11", to: "2026-01-20" });
    expect(c.current.postCount).toBe(2);
    expect(c.previous.postCount).toBe(1);
    expect(c.caveats.some((x) => x.includes("publicaciones"))).toBe(true);
  });

  it("flags a previous period with missing days", async () => {
    const c = await comparePeriods(repo, { from: "2026-01-06", to: "2026-01-20" });
    expect(c.caveats.some((x) => x.includes("parcial"))).toBe(true);
  });

  it("refuses to compare periods of different length", async () => {
    await expect(
      comparePeriods(repo, { from: "2026-01-11", to: "2026-01-20" }, { from: "2026-01-01", to: "2026-01-05" }),
    ).rejects.toThrow(/same number of days/);
  });
});

describe("getAccountMetrics", () => {
  it("returns one entry per calendar day, with explicit nulls for gaps", async () => {
    const repo = new FixtureRepository([], [makeDay("2026-01-01"), makeDay("2026-01-03")]);
    const m = await getAccountMetrics(repo, { from: "2026-01-01", to: "2026-01-03" });
    expect(m.series).toHaveLength(3);
    expect(m.series[1]).toMatchObject({ date: "2026-01-02", reach: null });
  });
});

describe("getTopPosts", () => {
  it("excludes tiny-reach posts from rate rankings", async () => {
    const repo = new FixtureRepository([
      makePost({ id: "tiny", metrics: { reach: 50, shares: 10 } }), // 200/1k but n/a
      makePost({ id: "real", metrics: { reach: 5000, shares: 50 } }), // 10/1k
    ]);
    const top = await getTopPosts(repo, { from: "2026-01-01", to: "2026-01-31" }, "sharesPer1k", 5);
    expect(top.map((p) => p.id)).toEqual(["real"]);
  });
  it("does not filter by reach for absolute metrics", async () => {
    const repo = new FixtureRepository([makePost({ id: "tiny", metrics: { reach: 50, views: 99999 } })]);
    const top = await getTopPosts(repo, { from: "2026-01-01", to: "2026-01-31" }, "views", 5);
    expect(top).toHaveLength(1);
  });
});

describe("getContentByDimension (aggregation)", () => {
  it("groups by tag, uses medians and reports n, confidence and untagged posts", async () => {
    const posts = [
      ...[10, 12, 14, 16, 1000].map((shares) => makePost({ metrics: { reach: 1000, shares }, tags: [tag("topic", "tiempo", "Falta de tiempo")] })),
      makePost({ metrics: { reach: 1000, shares: 5 }, tags: [tag("topic", "sueno", "Sueño")] }),
      makePost({ metrics: { reach: 1000, shares: 5 } }),
    ];
    const b = await getContentByDimension(new FixtureRepository(posts), "topic", { from: "2026-01-01", to: "2026-01-31" });
    const tiempo = b.groups.find((g) => g.slug === "tiempo")!;
    expect(tiempo.n).toBe(5);
    expect(tiempo.medianSharesPer1k).toBe(14); // median, the 1000 outlier does not dominate
    expect(tiempo.confidence).toBe("low");
    expect(b.groups.find((g) => g.slug === "sueno")!.confidence).toBe("insufficient");
    expect(b.untaggedPosts).toBe(1);
    expect(b.baseline.n).toBe(7);
  });
});
