"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getRepository } from "@/lib/data";
import { createExperiment, updateExperiment } from "@/services/experiments";

export type ActionState = { ok: boolean; message: string | null };

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join(" · ");
  return e instanceof Error ? e.message : "Error inesperado";
}

export async function createExperimentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const baselineRaw = String(form.get("baseline") ?? "").trim().replace(",", ".");
  try {
    await createExperiment(getRepository(), {
      name: form.get("name"),
      hypothesis: form.get("hypothesis"),
      metric: form.get("metric"),
      baseline: baselineRaw === "" ? null : Number(baselineRaw),
      baselineDescription: form.get("baselineDescription") ?? "",
      test: form.get("test"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
    });
    revalidatePath("/experiments");
    return { ok: true, message: "Experimento creado como borrador." };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function updateExperimentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const num = (k: string) => {
    const v = String(form.get(k) ?? "").trim().replace(",", ".");
    return v === "" ? undefined : Number(v);
  };
  const patch: Record<string, unknown> = { status: form.get("status") };
  if (num("result") !== undefined) patch.result = num("result");
  if (num("resultSampleSize") !== undefined) patch.resultSampleSize = num("resultSampleSize");
  const conclusion = String(form.get("conclusion") ?? "").trim();
  if (conclusion) patch.conclusion = conclusion;
  try {
    await updateExperiment(getRepository(), id, patch);
    revalidatePath("/experiments");
    return { ok: true, message: "Actualizado." };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}
