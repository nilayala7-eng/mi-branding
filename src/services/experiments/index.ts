import { z } from "zod";
import type { DataRepository, ExperimentPatch } from "@/lib/data/repository";
import { isISODate } from "@/lib/domain/periods";
import type { Experiment } from "@/lib/domain/types";
import { EXPERIMENT_METRICS } from "./metrics";

export { EXPERIMENT_METRICS };

const isoDate = z.string().refine(isISODate, "Expected a date as YYYY-MM-DD");

export const newExperimentSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    hypothesis: z.string().trim().min(10).max(1000),
    metric: z.enum(EXPERIMENT_METRICS),
    baseline: z.number().finite().nullable().default(null),
    baselineDescription: z.string().trim().max(500).default(""),
    test: z.string().trim().min(5).max(1000),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.startDate <= v.endDate, { message: "endDate must be on or after startDate", path: ["endDate"] });

export type NewExperimentInput = z.input<typeof newExperimentSchema>;

export async function createExperiment(repo: DataRepository, input: unknown): Promise<Experiment> {
  const parsed = newExperimentSchema.parse(input);
  return repo.createExperiment(parsed);
}

export const experimentPatchSchema = z
  .object({
    status: z.enum(["draft", "running", "completed", "inconclusive", "cancelled"]),
    result: z.number().finite().nullable(),
    resultSampleSize: z.number().int().nonnegative().nullable(),
    conclusion: z.string().trim().max(2000).nullable(),
    endDate: isoDate,
    test: z.string().trim().min(5).max(1000),
  })
  .partial();

export async function updateExperiment(repo: DataRepository, id: string, patch: unknown): Promise<Experiment> {
  const parsed: ExperimentPatch = experimentPatchSchema.parse(patch);
  if (parsed.status === "completed" && (parsed.result === undefined || parsed.result === null)) {
    const current = (await repo.listExperiments()).find((e) => e.id === id);
    if (!current || current.result === null) {
      throw new Error("A completed experiment needs a measured result. Use 'inconclusive' otherwise.");
    }
  }
  return repo.updateExperiment(id, parsed);
}

/**
 * Minimum posts before an experiment result may be called anything other than
 * inconclusive. Mirrors analyst rule #5.
 */
export const MIN_EXPERIMENT_SAMPLE = 5;

export function judgeExperiment(exp: Pick<Experiment, "baseline" | "result" | "resultSampleSize">): {
  verdict: "supported" | "not_supported" | "inconclusive";
  reason: string;
} {
  if (exp.result === null || exp.baseline === null) {
    return { verdict: "inconclusive", reason: "Falta baseline o resultado." };
  }
  if ((exp.resultSampleSize ?? 0) < MIN_EXPERIMENT_SAMPLE) {
    return { verdict: "inconclusive", reason: `Muestra insuficiente (n=${exp.resultSampleSize ?? 0}, mínimo ${MIN_EXPERIMENT_SAMPLE}).` };
  }
  if (exp.baseline === 0) return { verdict: "inconclusive", reason: "Baseline 0: no se puede calcular diferencia relativa." };
  const rel = exp.result / exp.baseline - 1;
  if (rel >= 0.15) return { verdict: "supported", reason: `Resultado ${Math.round(rel * 100)}% sobre baseline.` };
  if (rel <= -0.15) return { verdict: "not_supported", reason: `Resultado ${Math.round(rel * 100)}% bajo baseline.` };
  return { verdict: "inconclusive", reason: `Diferencia de ${Math.round(rel * 100)}%: dentro del ruido esperado (±15%).` };
}
