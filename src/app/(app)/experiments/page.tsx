import clsx from "clsx";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import type { ExperimentStatus } from "@/lib/domain/types";
import { fmtDate, fmtNumber } from "@/lib/format";
import { judgeExperiment } from "@/services/experiments";
import { NewExperimentForm, UpdateExperimentForm } from "./experiment-forms";

const STATUS: Record<ExperimentStatus, string> = {
  draft: "border-border-strong text-ink-soft",
  running: "border-[#3987e5]/50 text-[#7fb0ef]",
  completed: "border-good/40 text-good",
  inconclusive: "border-warning/40 text-warning",
  cancelled: "border-border text-ink-muted",
};

export default async function ExperimentsPage() {
  const repo = getRepository();
  const [account, experiments] = await Promise.all([repo.getAccount(), repo.listExperiments()]);

  return (
    <>
      <PageHeader
        title="Experiments"
        subtitle="Cada experimento convierte una hipótesis en aprendizaje. Un resultado solo cuenta con n ≥ 5 y una diferencia fuera del ruido (±15 %)."
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          {experiments.length === 0 && <EmptyState title="Todavía no hay experimentos" />}
          {experiments.map((e) => {
            const verdict = judgeExperiment(e);
            return (
              <Card key={e.id} as="article" className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-display text-[15px] font-semibold">{e.name}</h2>
                  <span className={clsx("rounded-full border px-2 py-0.5 text-[11px]", STATUS[e.status])}>{e.status}</span>
                </div>
                <p className="mt-2 text-[13px] italic text-ink-soft">{e.hypothesis}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-muted">Métrica</dt>
                    <dd className="text-ink-soft">{e.metric}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Baseline</dt>
                    <dd className="tabular-nums text-ink-soft" title={e.baselineDescription}>
                      {fmtNumber(e.baseline, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Resultado</dt>
                    <dd className="tabular-nums text-ink-soft">
                      {fmtNumber(e.result, 2)} {e.resultSampleSize !== null && <span className="text-ink-muted">(n={e.resultSampleSize})</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Fechas</dt>
                    <dd className="text-ink-soft">
                      {fmtDate(e.startDate, { day: "numeric", month: "short" })} → {fmtDate(e.endDate, { day: "numeric", month: "short" })}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-muted">Test</dt>
                    <dd className="text-ink-soft">{e.test}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-ink-muted">Lectura automática</dt>
                    <dd className="text-ink-soft">
                      {verdict.verdict} — {verdict.reason}
                    </dd>
                  </div>
                  {e.conclusion && (
                    <div className="col-span-2 sm:col-span-3">
                      <dt className="text-ink-muted">Conclusión</dt>
                      <dd className="text-ink">{e.conclusion}</dd>
                    </div>
                  )}
                </dl>
                <UpdateExperimentForm experiment={e} />
              </Card>
            );
          })}
        </div>
        <Card className="h-fit xl:col-span-2">
          <CardHeader title="Nuevo experimento" description="Se crea como borrador. Una variable a la vez; el resto, igual que siempre." />
          <NewExperimentForm today={account.today} />
        </Card>
      </div>
    </>
  );
}
