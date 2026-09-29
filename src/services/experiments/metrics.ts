import type { ExperimentMetric } from "@/lib/domain/types";

/** Dependency-free so client components can import it. */
export const EXPERIMENT_METRICS = [
  "views",
  "reach",
  "shares",
  "saves",
  "follows",
  "comments",
  "likes",
  "engagement_rate",
  "shares_per_1k_reach",
  "saves_per_1k_reach",
  "follows_per_1k_reach",
] as const satisfies readonly ExperimentMetric[];
