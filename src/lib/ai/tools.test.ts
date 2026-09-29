import { describe, expect, it } from "vitest";
import { MockRepository } from "@/lib/data/mock/mock-repository";
import { FixtureRepository, makePost } from "@/test/fixtures";
import { executeTool, serializePost, TOOLS, toolInputJsonSchema } from "./tools";

const repo = new MockRepository("2026-09-29");

describe("tool registry", () => {
  it("exposes the planned tools with unique names", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ["get_account_metrics", "get_post_metrics", "get_top_posts", "compare_periods", "search_posts", "get_content_patterns", "get_experiments", "get_strategy", "create_experiment"]) {
      expect(names).toContain(n);
    }
  });

  it("produces object JSON schemas for the Claude API", () => {
    for (const t of TOOLS) {
      const s = toolInputJsonSchema(t);
      expect(s.type).toBe("object");
      expect(s).not.toHaveProperty("$schema");
    }
  });

  it("only create_experiment mutates", () => {
    expect(TOOLS.filter((t) => "mutates" in t && t.mutates).map((t) => t.name)).toEqual(["create_experiment"]);
  });
});

describe("executeTool input validation", () => {
  it("rejects malformed dates", async () => {
    await expect(executeTool(repo, "get_account_metrics", { from: "yesterday", to: "2026-09-29" })).rejects.toThrow();
  });
  it("rejects inverted ranges", async () => {
    await expect(executeTool(repo, "get_account_metrics", { from: "2026-09-29", to: "2026-09-01" })).rejects.toThrow(/before/);
  });
  it("caps limits", async () => {
    await expect(executeTool(repo, "search_posts", { limit: 5000 })).rejects.toThrow();
  });
  it("rejects unknown tools", async () => {
    await expect(executeTool(repo, "drop_database", {})).rejects.toThrow(/Unknown tool/);
  });
});

describe("tool outputs", () => {
  it("compare_periods defaults to the equivalent previous period", async () => {
    const out = (await executeTool(repo, "compare_periods", { from: "2026-09-01", to: "2026-09-29" })) as {
      previous: { range: { from: string; to: string } };
    };
    // 1–29 Sept is 29 days → the 29 days before it
    expect(out.previous.range).toEqual({ from: "2026-08-03", to: "2026-08-31" });
  });

  it("get_account_metrics downsamples long ranges to weeks", async () => {
    const out = (await executeTool(repo, "get_account_metrics", { from: "2025-10-01", to: "2026-09-29" })) as { series: unknown[] };
    expect(out.series.length).toBeLessThanOrEqual(53);
  });

  it("search_posts returns compact posts", async () => {
    const out = (await executeTool(repo, "search_posts", { limit: 3 })) as { posts: { caption: string }[] };
    expect(out.posts).toHaveLength(3);
  });

  it("create_experiment validates and creates a draft", async () => {
    const r = new FixtureRepository();
    const e = (await executeTool(r, "create_experiment", {
      name: "Test hooks",
      hypothesis: "Hooks de tiempo generan más shares",
      metric: "shares_per_1k_reach",
      baseline: 4.2,
      baselineDescription: "mediana 90d",
      test: "6 reels en 3 semanas",
      startDate: "2026-10-01",
      endDate: "2026-10-21",
    })) as { status: string };
    expect(e.status).toBe("draft");
    expect(r.experiments).toHaveLength(1);
  });
});

describe("serializePost", () => {
  it("truncates long captions and flattens tags", () => {
    const p = serializePost(makePost({ caption: "x".repeat(500) }));
    expect(p.caption.length).toBeLessThanOrEqual(221);
    expect(p.tags).toEqual({});
  });
});
