import { describe, expect, it } from "vitest";
import { generateMockDataset } from "./generator";

describe("mock generator", () => {
  it("is deterministic for the same inputs", () => {
    expect(generateMockDataset("2026-09-29", 7)).toEqual(generateMockDataset("2026-09-29", 7));
  });
  it("covers the requested history and ends today", () => {
    const d = generateMockDataset("2026-09-29", 1, 100);
    expect(d.accountDays).toHaveLength(100);
    expect(d.accountDays.at(-1)?.date).toBe("2026-09-29");
  });
  it("produces unique media ids (sync idempotency key)", () => {
    const d = generateMockDataset("2026-09-29");
    expect(new Set(d.posts.map((p) => p.igMediaId)).size).toBe(d.posts.length);
  });
  it("only tags with values that exist in the taxonomy", () => {
    const d = generateMockDataset("2026-09-29");
    const ids = new Set(d.taxonomy.map((t) => t.id));
    for (const p of d.posts) for (const t of p.tags) expect(ids.has(t.valueId)).toBe(true);
  });
});
