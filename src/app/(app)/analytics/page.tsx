import { Suspense } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { TrendChart, TrendLegend } from "@/components/charts/trend-chart";
import { Card, CardHeader, Delta, PageHeader } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { fmtDate, fmtNumber, fmtRate } from "@/lib/format";
import { alignSeries, bucketSize, type SeriesMetric } from "@/lib/metrics/series";
import { rangeFromSearchParams } from "@/lib/page-params";
import { comparePeriods, getAccountMetrics, type ComparableMetric } from "@/services/analytics";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const CHARTS: {
  metric: SeriesMetric;
  total: ComparableMetric;
  title: string;
  description: string;
  format?: "rate";
}[] = [
  { metric: "followers", total: "followersEnd", title: "Crecimiento de seguidores", description: "Seguidores al cierre" },
  { metric: "followsGained", total: "followsGained", title: "Follows", description: "Nuevos seguidores" },
  { metric: "reach", total: "reach", title: "Reach", description: "Suma de reach diario" },
  { metric: "views", total: "views", title: "Views", description: "Visualizaciones" },
  { metric: "engagementRate", total: "engagementRate", title: "Engagement rate", description: "(likes + comments + shares + saves) / reach", format: "rate" },
  { metric: "shares", total: "shares", title: "Shares", description: "Veces compartido" },
  { metric: "saves", total: "saves", title: "Saves", description: "Guardados" },
  { metric: "comments", total: "comments", title: "Comments", description: "Comentarios" },
];

export default async function AnalyticsPage({ searchParams }: Props) {
  const repo = getRepository();
  const account = await repo.getAccount();
  const { preset, range } = rangeFromSearchParams(await searchParams, account.today);
  const cmp = await comparePeriods(repo, range);
  const [cur, prev] = await Promise.all([getAccountMetrics(repo, range), getAccountMetrics(repo, cmp.previous.range)]);
  const bucket = bucketSize(cur.series.length);
  const fmtShort = (d: string) =>
    fmtDate(d, cur.series.length > 200 ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={
          <>
            {fmtDate(range.from)} → {fmtDate(range.to)} frente al periodo equivalente anterior ({fmtDate(cmp.previous.range.from)} →{" "}
            {fmtDate(cmp.previous.range.to)}).{" "}
            {bucket > 1 && <span className="text-ink-muted">Agrupado cada {bucket} días para mostrar tendencia.</span>}
          </>
        }
        actions={
          <Suspense>
            <PeriodPicker preset={preset} range={range} />
          </Suspense>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {CHARTS.map((c) => {
          const points = alignSeries(cur.series, prev.series, c.metric, bucket).map((p) => ({
            label: fmtShort(p.date),
            previousLabel: p.previousDate ? fmtShort(p.previousDate) : undefined,
            current: p.current,
            previous: p.previous,
          }));
          const value = cmp.current.totals[c.total];
          return (
            <Card key={c.metric}>
              <CardHeader
                title={c.title}
                description={c.description}
                right={
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold tabular-nums">
                      {c.format === "rate" ? fmtRate(value) : fmtNumber(value)}
                    </div>
                    <Delta value={cmp.change[c.total]} />
                  </div>
                }
              />
              <div className="px-3 pb-3 pt-1">
                <TrendChart data={points} format={c.format ?? "number"} ariaLabel={`${c.title}: actual frente a anterior`} height={170} />
              </div>
              <div className="flex justify-end px-5 pb-4">
                <TrendLegend />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader title="Comparación de periodos" description="Totales del periodo; misma duración en ambos lados." />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="pb-2 font-normal">Métrica</th>
                <th className="pb-2 text-right font-normal">Actual</th>
                <th className="pb-2 text-right font-normal">Anterior</th>
                <th className="pb-2 text-right font-normal">Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(
                [
                  ["Reach (suma diaria)", "reach"],
                  ["Views", "views"],
                  ["Likes", "likes"],
                  ["Comments", "comments"],
                  ["Shares", "shares"],
                  ["Saves", "saves"],
                  ["Follows", "followsGained"],
                  ["Unfollows", "unfollows"],
                  ["Cambio neto de seguidores", "netFollowerChange"],
                  ["Visitas al perfil", "profileVisits"],
                  ["Engagement rate", "engagementRate"],
                ] as [string, ComparableMetric][]
              ).map(([label, key]) => (
                <tr key={key}>
                  <td className="py-2 text-ink-soft">{label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {key === "engagementRate" ? fmtRate(cmp.current.totals[key]) : fmtNumber(cmp.current.totals[key])}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {key === "engagementRate" ? fmtRate(cmp.previous.totals[key]) : fmtNumber(cmp.previous.totals[key])}
                  </td>
                  <td className="py-2 text-right">
                    <Delta value={cmp.change[key]} goodWhen={key === "unfollows" ? "down" : "up"} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-ink-soft">Publicaciones</td>
                <td className="py-2 text-right tabular-nums">{cmp.current.postCount}</td>
                <td className="py-2 text-right tabular-nums text-ink-soft">{cmp.previous.postCount}</td>
                <td />
              </tr>
            </tbody>
          </table>
          {cmp.caveats.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {cmp.caveats.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
