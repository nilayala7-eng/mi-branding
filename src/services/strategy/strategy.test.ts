import { describe, expect, it } from "vitest";
import type { PostMetrics } from "@/lib/domain/types";
import { FixtureRepository, makePost, tag } from "@/test/fixtures";
import { detectPatterns, generateStrategy, lift, patternConfidence } from ".";

const range = { from: "2026-01-01", to: "2026-01-31" };

function group(slug: string, n: number, metrics: Partial<PostMetrics>) {
  return Array.from({ length: n }, () => makePost({ metrics: { reach: 1000, ...metrics }, tags: [tag("hook", slug, slug)] }));
}

describe("lift / confidence", () => {
  it("lift is relative to baseline and null on zero baseline", () => {
    expect(lift(15, 10)).toBeCloseTo(0.5);
    expect(lift(5, 0)).toBeNull();
  });
  it("observational patterns never reach 'high'", () => {
    expect(patternConfidence(4)).toBe("insufficient");
    expect(patternConfidence(5)).toBe("low");
    expect(patternConfidence(100)).toBe("medium");
  });
});

describe("detectPatterns", () => {
  it("ignores groups smaller than 5 even with a huge difference", async () => {
    const repo = new FixtureRepository([...group("viral", 3, { shares: 200 }), ...group("normal", 10, { shares: 5 })]);
    const r = await detectPatterns(repo, range);
    expect(r.insights.find((i) => i.id.startsWith("hook:viral"))).toBeUndefined();
    expect(r.skippedSmallGroups).toBeGreaterThanOrEqual(1);
  });

  it("reports a positive pattern with separated data / interpretation / hypothesis / recommendation", async () => {
    const repo = new FixtureRepository([...group("tiempo", 6, { shares: 20 }), ...group("otro", 10, { shares: 5 })]);
    const r = await detectPatterns(repo, range);
    const i = r.insights.find((x) => x.id === "hook:tiempo:medianSharesPer1k")!;
    expect(i.kind).toBe("positive");
    expect(i.data.sampleSize).toBe(6);
    expect(i.data.statement).toMatch(/6 publicaciones/);
    expect(i.interpretation).not.toEqual(i.hypothesis);
    expect(i.hypothesis).toMatch(/Puede que/); // hedged, not stated as fact
    expect(i.recommendation).toMatch(/experimento/);
    expect(i.caveats.join(" ")).toMatch(/correlación, no causalidad/);
    expect(r.suggestedExperiments.some((e) => e.sourceInsightId === i.id)).toBe(true);
  });

  it("marks insights from mock data", async () => {
    const repo = new FixtureRepository([...group("a", 6, { shares: 20 }), ...group("b", 10, { shares: 5 })], [], "2026-01-31", true);
    const r = await detectPatterns(repo, range);
    expect(r.insights.every((i) => i.caveats.some((c) => c.includes("DEMOSTRACIÓN")))).toBe(true);
  });

  it("detects 'views but few follows'", async () => {
    const repo = new FixtureRepository([
      ...group("click", 6, { views: 5000, follows: 0.5 }),
      ...group("normal", 10, { views: 1000, follows: 3 }),
    ]);
    const r = await detectPatterns(repo, range);
    expect(r.insights.some((i) => i.id === "opportunity:hook:click:views-no-follows")).toBe(true);
  });

  it("does not recommend anything based on views alone", async () => {
    const repo = new FixtureRepository([
      ...group("bigviews", 6, { views: 50_000 }),
      ...group("normal", 10, { views: 1000 }),
    ]);
    const r = await detectPatterns(repo, range);
    expect(r.insights.filter((i) => i.id.startsWith("hook:bigviews"))).toHaveLength(0);
  });
});

describe("generateStrategy", () => {
  it("returns at most 3 actionable items and never insufficient ones", async () => {
    const repo = new FixtureRepository([
      ...group("a", 6, { shares: 20 }),
      ...group("b", 6, { saves: 30 }),
      ...group("c", 6, { follows: 10 }),
      ...group("d", 6, { shares: 1 }),
      ...group("e", 12, {}),
    ]);
    const s = await generateStrategy(repo, range);
    expect(s.whatToDoNext.length).toBeLessThanOrEqual(3);
    expect(s.whatToDoNext.every((i) => i.confidence !== "insufficient")).toBe(true);
  });
});
