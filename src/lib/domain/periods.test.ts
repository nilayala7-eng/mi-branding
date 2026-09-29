import { describe, expect, it } from "vitest";
import {
  addDays,
  assertValidRange,
  eachDay,
  isISODate,
  presetRange,
  previousPeriod,
  rangeLength,
  resolveRange,
} from "./periods";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-2-3")).toBe(false);
    expect(isISODate("'; drop table")).toBe(false);
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("eachDay is inclusive", () => {
    expect(eachDay({ from: "2026-01-30", to: "2026-02-02" })).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("presets", () => {
  it.each([
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
    ["6m", 182],
    ["1y", 365],
  ] as const)("%s covers %i days ending today", (preset, days) => {
    const r = presetRange(preset, "2026-09-29");
    expect(r.to).toBe("2026-09-29");
    expect(rangeLength(r)).toBe(days);
  });
});

describe("previousPeriod (equivalent comparison)", () => {
  it("has the same length and ends the day before", () => {
    const cur = { from: "2026-09-01", to: "2026-09-30" };
    const prev = previousPeriod(cur);
    expect(rangeLength(prev)).toBe(rangeLength(cur));
    expect(prev).toEqual({ from: "2026-08-02", to: "2026-08-31" });
  });
  it("works for a single day", () => {
    expect(previousPeriod({ from: "2026-01-01", to: "2026-01-01" })).toEqual({ from: "2025-12-31", to: "2025-12-31" });
  });
});

describe("resolveRange (untrusted query params)", () => {
  const today = "2026-09-29";
  it("defaults to 30 days on unknown presets", () => {
    expect(resolveRange({ preset: "evil" }, today)).toEqual({ preset: "30d", range: presetRange("30d", today) });
  });
  it("accepts a valid custom range", () => {
    expect(resolveRange({ preset: "custom", from: "2026-01-01", to: "2026-01-31" }, today).range).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });
  it("rejects inverted or malformed custom ranges", () => {
    expect(resolveRange({ preset: "custom", from: "2026-02-01", to: "2026-01-01" }, today).preset).toBe("30d");
    expect(resolveRange({ preset: "custom", from: "x", to: "2026-01-01" }, today).preset).toBe("30d");
  });
  it("assertValidRange throws on bad input", () => {
    expect(() => assertValidRange({ from: "2026-02-01", to: "2026-01-01" })).toThrow();
  });
});
