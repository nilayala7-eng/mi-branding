/**
 * Tool registry shared by the in-app Claude chat and the MCP server.
 *
 * Each tool: a zod input schema (validated on every call), a description
 * written for the model, and a `run` that calls the service layer and returns
 * compact JSON. Outputs are deliberately small — Claude gets structured
 * summaries, never the whole database.
 */
import { z } from "zod";
import type { DataRepository, PostSortKey } from "@/lib/data/repository";
import { isISODate, previousPeriod, rangeLength, type DateRange } from "@/lib/domain/periods";
import type { Post } from "@/lib/domain/types";
import { postRates } from "@/lib/metrics/calculations";
import {
  comparePeriods,
  getAccountMetrics,
  getContentByDimension,
  getPostMetrics,
  getTopPosts,
} from "@/services/analytics";
import { createExperiment, EXPERIMENT_METRICS } from "@/services/experiments";
import { detectPatterns } from "@/services/strategy";

const isoDate = z.string().refine(isISODate, "Expected YYYY-MM-DD");
const rangeShape = {
  from: isoDate.describe("Start date, inclusive (YYYY-MM-DD)"),
  to: isoDate.describe("End date, inclusive (YYYY-MM-DD)"),
};
const DIMENSIONS = ["topic", "subtopic", "hook", "cta", "format", "visual_style", "audio"] as const;
const SORT_KEYS = [
  "publishedAt",
  "views",
  "reach",
  "shares",
  "saves",
  "follows",
  "comments",
  "likes",
  "engagementRate",
  "sharesPer1k",
  "savesPer1k",
  "followsPer1k",
] as const satisfies readonly PostSortKey[];

function toRange(i: { from: string; to: string }): DateRange {
  if (i.from > i.to) throw new RangeError("'from' must be on or before 'to'.");
  if (rangeLength(i) > 800) throw new RangeError("Range too long (max 800 days).");
  return { from: i.from, to: i.to };
}

const round = (n: number | null, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Compact post representation for the model. */
export function serializePost(p: Post) {
  const r = postRates(p.metrics);
  return {
    id: p.id,
    publishedAt: p.publishedAt,
    type: p.mediaType,
    durationSec: p.durationSec,
    caption: p.caption.length > 220 ? `${p.caption.slice(0, 220)}…` : p.caption,
    metrics: p.metrics,
    rates: {
      engagementRate: round(r.engagementRate, 4),
      sharesPer1kReach: round(r.sharesPer1k),
      savesPer1kReach: round(r.savesPer1k),
      followsPer1kReach: round(r.followsPer1k),
    },
    tags: Object.fromEntries(p.tags.map((t) => [t.dimension, t.label])),
  };
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  /** True if the tool writes data. */
  mutates?: boolean;
  run(repo: DataRepository, input: z.output<S>): Promise<unknown>;
}

function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

export const TOOLS = [
  defineTool({
    name: "get_account_metrics",
    description:
      "Account-level totals for a date range (reach as sum of daily reach, views, likes, comments, shares, saves, follows gained, unfollows, followers at start/end, engagement rate) plus a daily series (weekly buckets if the range exceeds 60 days).",
    schema: z.object(rangeShape),
    async run(repo, input) {
      const m = await getAccountMetrics(repo, toRange(input));
      let series: unknown = m.series;
      if (m.series.length > 60) {
        const weeks: Record<string, number | string | null>[] = [];
        for (let i = 0; i < m.series.length; i += 7) {
          const chunk = m.series.slice(i, i + 7);
          const sum = (k: "reach" | "views" | "followsGained" | "shares" | "saves") =>
            chunk.reduce<number | null>((s, d) => (d[k] === null ? s : (s ?? 0) + (d[k] as number)), null);
          weeks.push({
            weekStart: chunk[0].date,
            reach: sum("reach"),
            views: sum("views"),
            followsGained: sum("followsGained"),
            shares: sum("shares"),
            saves: sum("saves"),
            followersEnd: chunk.at(-1)?.followers ?? null,
          });
        }
        series = weeks;
      }
      return { range: m.range, totals: m.totals, series };
    },
  }),
  defineTool({
    name: "compare_periods",
    description:
      "Compares a date range with the equivalent previous period (same length, immediately before) unless an explicit equal-length comparison range is given. Returns totals for both, relative change per metric and caveats (e.g. different post counts).",
    schema: z.object({
      ...rangeShape,
      againstFrom: isoDate.optional().describe("Optional comparison start (must match length)"),
      againstTo: isoDate.optional(),
    }),
    async run(repo, input) {
      const range = toRange(input);
      const against =
        input.againstFrom && input.againstTo ? toRange({ from: input.againstFrom, to: input.againstTo }) : previousPeriod(range);
      return comparePeriods(repo, range, against);
    },
  }),
  defineTool({
    name: "get_top_posts",
    description:
      "Top posts in a range ranked by a metric. Prefer rate metrics (sharesPer1k, savesPer1k, followsPer1k, engagementRate) over raw views; rate rankings exclude posts with reach < 300.",
    schema: z.object({
      ...rangeShape,
      by: z.enum(SORT_KEYS).default("sharesPer1k"),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    async run(repo, input) {
      const posts = await getTopPosts(repo, toRange(input), input.by, input.limit);
      return { by: input.by, count: posts.length, posts: posts.map(serializePost) };
    },
  }),
  defineTool({
    name: "search_posts",
    description:
      "Search/filter posts by date range, caption text, media type and taxonomy tag (dimension + value slug). Returns compact posts with metrics, per-1k-reach rates and tags.",
    schema: z.object({
      from: isoDate.optional(),
      to: isoDate.optional(),
      query: z.string().max(100).optional().describe("Case-insensitive caption substring"),
      mediaType: z.enum(["REEL", "CAROUSEL", "IMAGE", "STORY"]).optional(),
      dimension: z.enum(DIMENSIONS).optional(),
      value: z.string().max(80).optional().describe("Taxonomy value slug, e.g. 'falta-de-tiempo'"),
      sort: z.enum(SORT_KEYS).default("publishedAt"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    async run(repo, input) {
      const posts = await getPostMetrics(repo, {
        range: input.from && input.to ? toRange({ from: input.from, to: input.to }) : undefined,
        search: input.query,
        mediaTypes: input.mediaType ? [input.mediaType] : undefined,
        tag: input.dimension && input.value ? { dimension: input.dimension, slug: input.value } : undefined,
        sort: input.sort,
        order: "desc",
        limit: input.limit,
      });
      return { count: posts.length, posts: posts.map(serializePost) };
    },
  }),
  defineTool({
    name: "get_post_metrics",
    description: "Full metrics, rates and tags for a single post by id.",
    schema: z.object({ postId: z.string().min(1).max(100) }),
    async run(repo, input) {
      const p = await repo.getPost(input.postId);
      return p ? serializePost(p) : { error: "not_found" };
    },
  }),
  defineTool({
    name: "get_content_patterns",
    description:
      "Median performance per taxonomy value (topic, hook, cta, format…) for a range, with sample size n and confidence per group, plus the account baseline. Use this to compare content types; groups with n < 5 are not evidence.",
    schema: z.object({ ...rangeShape, dimension: z.enum(DIMENSIONS) }),
    async run(repo, input) {
      return getContentByDimension(repo, input.dimension, toRange(input));
    },
  }),
  defineTool({
    name: "get_strategy",
    description:
      "Pre-computed pattern detection for a range: positive/negative patterns, recent changes, opportunities and suggested experiments, each with data, interpretation, hypothesis, recommendation, confidence and caveats.",
    schema: z.object(rangeShape),
    async run(repo, input) {
      return detectPatterns(repo, toRange(input));
    },
  }),
  defineTool({
    name: "get_experiments",
    description: "Lists content experiments with hypothesis, metric, baseline, dates, status, result and conclusion.",
    schema: z.object({}),
    async run(repo) {
      return { experiments: await repo.listExperiments() };
    },
  }),
  defineTool({
    name: "get_taxonomy",
    description: "Lists the current content taxonomy (dimensions and values with slugs) used for tagging posts.",
    schema: z.object({}),
    async run(repo) {
      const values = await repo.getTaxonomy();
      return { values: values.filter((v) => v.active).map(({ dimension, slug, label, parentId }) => ({ dimension, slug, label, parentId })) };
    },
  }),
  defineTool({
    name: "create_experiment",
    description:
      "Creates a DRAFT experiment. Only call when the user explicitly asks to create one. Baseline must come from data retrieved in this conversation (or null).",
    mutates: true,
    schema: z.object({
      name: z.string().min(3).max(120),
      hypothesis: z.string().min(10).max(1000),
      metric: z.enum(EXPERIMENT_METRICS),
      baseline: z.number().nullable(),
      baselineDescription: z.string().max(500),
      test: z.string().min(5).max(1000),
      startDate: isoDate,
      endDate: isoDate,
    }),
    async run(repo, input) {
      return createExperiment(repo, input);
    },
  }),
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

export function findTool(name: string): ToolDef | undefined {
  return (TOOLS as readonly ToolDef[]).find((t) => t.name === name);
}

/** Validates input with the tool's schema, then runs it. Throws on invalid input. */
export async function executeTool(repo: DataRepository, name: string, rawInput: unknown): Promise<unknown> {
  const tool = findTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const input = tool.schema.parse(rawInput ?? {});
  return tool.run(repo, input);
}

/** JSON Schema for a tool's input (object schema, as the Claude API expects). */
export function toolInputJsonSchema(tool: ToolDef): { type: "object"; [k: string]: unknown } {
  const schema = z.toJSONSchema(tool.schema, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return { ...schema, type: "object" };
}
