import { describe, expect, it } from "vitest";
import { FixtureRepository } from "@/test/fixtures";
import { createExperiment, judgeExperiment, updateExperiment } from ".";

const valid = {
  name: "Hooks de falta de tiempo",
  hypothesis: "Los hooks relacionados con falta de tiempo generan más shares.",
  metric: "shares_per_1k_reach",
  baseline: 4,
  baselineDescription: "Mediana 90d",
  test: "6 Reels en 3 semanas",
  startDate: "2026-10-01",
  endDate: "2026-10-21",
};

describe("createExperiment", () => {
  it("creates a draft", async () => {
    const repo = new FixtureRepository();
    const e = await createExperiment(repo, valid);
    expect(e.status).toBe("draft");
  });
  it("rejects end before start, unknown metrics and empty hypotheses", async () => {
    const repo = new FixtureRepository();
    await expect(createExperiment(repo, { ...valid, endDate: "2026-09-01" })).rejects.toThrow();
    await expect(createExperiment(repo, { ...valid, metric: "vibes" })).rejects.toThrow();
    await expect(createExperiment(repo, { ...valid, hypothesis: "" })).rejects.toThrow();
  });
});

describe("updateExperiment", () => {
  it("refuses 'completed' without a result", async () => {
    const repo = new FixtureRepository();
    const e = await createExperiment(repo, valid);
    await expect(updateExperiment(repo, e.id, { status: "completed" })).rejects.toThrow(/result/);
    await expect(updateExperiment(repo, e.id, { status: "completed", result: 5, resultSampleSize: 6 })).resolves.toMatchObject({ status: "completed" });
  });
});

describe("judgeExperiment", () => {
  it("is inconclusive with small samples, whatever the result", () => {
    expect(judgeExperiment({ baseline: 4, result: 40, resultSampleSize: 2 }).verdict).toBe("inconclusive");
  });
  it("treats ±15% as noise", () => {
    expect(judgeExperiment({ baseline: 4, result: 4.4, resultSampleSize: 8 }).verdict).toBe("inconclusive");
  });
  it("supports / rejects outside the noise band", () => {
    expect(judgeExperiment({ baseline: 4, result: 5, resultSampleSize: 8 }).verdict).toBe("supported");
    expect(judgeExperiment({ baseline: 4, result: 3, resultSampleSize: 8 }).verdict).toBe("not_supported");
  });
});
