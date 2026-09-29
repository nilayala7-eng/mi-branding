"use client";

import { useActionState } from "react";
import clsx from "clsx";
import type { Experiment } from "@/lib/domain/types";
import { EXPERIMENT_METRICS } from "@/services/experiments/metrics";
import { createExperimentAction, updateExperimentAction, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };
const input = "w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted";

function Message({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={clsx("text-xs", state.ok ? "text-good" : "text-critical")} role="status">{state.message}</p>;
}

export function NewExperimentForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createExperimentAction, initial);
  return (
    <form action={action} className="grid gap-3 p-5 text-xs md:grid-cols-2">
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-ink-muted">Nombre</span>
        <input name="name" required minLength={3} maxLength={120} className={input} placeholder="Hooks de falta de tiempo" />
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-ink-muted">Hipótesis (falsable)</span>
        <textarea
          name="hypothesis"
          required
          minLength={10}
          rows={2}
          className={input}
          placeholder="Los hooks relacionados con falta de tiempo generan más shares por 1.000 cuentas alcanzadas."
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Métrica</span>
        <select name="metric" className={input} defaultValue="shares_per_1k_reach">
          {EXPERIMENT_METRICS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Baseline (opcional)</span>
        <input name="baseline" inputMode="decimal" className={input} placeholder="p. ej. 4,2" />
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-ink-muted">Origen del baseline</span>
        <input name="baselineDescription" maxLength={500} className={input} placeholder="Mediana de Reels últimos 90 días (n=…)" />
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-ink-muted">Test</span>
        <textarea name="test" required minLength={5} rows={2} className={input} placeholder="6 Reels en 3 semanas, mismo formato y horario." />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Inicio</span>
        <input type="date" name="startDate" required defaultValue={today} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Fin</span>
        <input type="date" name="endDate" required className={input} />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent/90 disabled:opacity-60">
          {pending ? "Guardando…" : "Crear experimento"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function UpdateExperimentForm({ experiment }: { experiment: Experiment }) {
  const [state, action, pending] = useActionState(updateExperimentAction, initial);
  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
      <input type="hidden" name="id" value={experiment.id} />
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Estado</span>
        <select name="status" defaultValue={experiment.status} className={input}>
          {["draft", "running", "completed", "inconclusive", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">Resultado</span>
        <input name="result" inputMode="decimal" defaultValue={experiment.result ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-muted">n resultado</span>
        <input name="resultSampleSize" inputMode="numeric" defaultValue={experiment.resultSampleSize ?? ""} className={input} />
      </label>
      <div className="flex items-end">
        <button disabled={pending} className="w-full rounded-md bg-surface-2 px-3 py-1.5 text-sm text-ink hover:bg-border disabled:opacity-60">
          {pending ? "…" : "Guardar"}
        </button>
      </div>
      <label className="flex flex-col gap-1 sm:col-span-4">
        <span className="text-ink-muted">Conclusión</span>
        <input name="conclusion" defaultValue={experiment.conclusion ?? ""} className={input} placeholder="Qué hemos aprendido (y con qué n)" />
      </label>
      <div className="sm:col-span-4">
        <Message state={state} />
      </div>
    </form>
  );
}
