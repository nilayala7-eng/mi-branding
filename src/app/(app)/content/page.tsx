import { Suspense } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { PostThumb } from "@/components/post-thumb";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import type { PostSortKey } from "@/lib/data/repository";
import type { MediaType, TaxonomyDimensionKey } from "@/lib/domain/types";
import { fmtCompact, fmtDate, fmtDuration, fmtNumber, fmtRate, fmtTime } from "@/lib/format";
import { param, rangeFromSearchParams } from "@/lib/page-params";
import { getPostMetrics } from "@/services/analytics";
import { TAXONOMY_DIMENSIONS } from "@/lib/data/taxonomy-seed";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SORTS: { value: PostSortKey; label: string }[] = [
  { value: "publishedAt", label: "Más recientes" },
  { value: "views", label: "Views" },
  { value: "reach", label: "Reach" },
  { value: "sharesPer1k", label: "Shares / 1k reach" },
  { value: "savesPer1k", label: "Saves / 1k reach" },
  { value: "followsPer1k", label: "Follows / 1k reach" },
  { value: "engagementRate", label: "Engagement rate" },
  { value: "comments", label: "Comments" },
];
const TYPES: MediaType[] = ["REEL", "CAROUSEL", "IMAGE"];
const DIM_KEYS = TAXONOMY_DIMENSIONS.map((d) => d.key);

export default async function ContentPage({ searchParams }: Props) {
  const repo = getRepository();
  const account = await repo.getAccount();
  const sp = await searchParams;
  const { preset, range } = rangeFromSearchParams({ period: "90d", ...sp }, account.today);

  // Validate every query param against known values — never trust the URL.
  const q = (param(sp, "q") ?? "").slice(0, 100);
  const typeParam = param(sp, "type");
  const type = TYPES.find((t) => t === typeParam);
  const sortParam = param(sp, "sort");
  const sort = SORTS.find((s) => s.value === sortParam)?.value ?? "publishedAt";
  const tagParam = param(sp, "tag"); // "dimension:slug"
  const [tagDim, tagSlug] = tagParam?.split(":") ?? [];
  const tag =
    tagDim && tagSlug && DIM_KEYS.includes(tagDim as TaxonomyDimensionKey)
      ? { dimension: tagDim as TaxonomyDimensionKey, slug: tagSlug }
      : undefined;

  const [posts, taxonomy] = await Promise.all([
    getPostMetrics(repo, { range, search: q || undefined, mediaTypes: type ? [type] : undefined, sort, order: "desc", tag }),
    repo.getTaxonomy(),
  ]);
  const untagged = posts.filter((p) => p.tags.length === 0).length;

  return (
    <>
      <PageHeader
        title="Content"
        subtitle={`${posts.length} publicaciones · ${fmtDate(range.from)} → ${fmtDate(range.to)}${untagged ? ` · ${untagged} sin clasificar` : ""}`}
        actions={
          <Suspense>
            <PeriodPicker preset={preset} range={range} />
          </Suspense>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 text-xs">
        {/* keep the period selection when filtering */}
        {param(sp, "period") && <input type="hidden" name="period" value={param(sp, "period")!} />}
        {param(sp, "from") && <input type="hidden" name="from" value={param(sp, "from")!} />}
        {param(sp, "to") && <input type="hidden" name="to" value={param(sp, "to")!} />}
        <label className="flex flex-col gap-1">
          <span className="text-ink-muted">Buscar en caption</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="p. ej. cardio"
            className="w-48 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-muted">Tipo</span>
          <select name="type" defaultValue={type ?? ""} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-muted">Etiqueta</span>
          <select name="tag" defaultValue={tagParam ?? ""} className="max-w-56 rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            {TAXONOMY_DIMENSIONS.map((d) => (
              <optgroup key={d.key} label={d.label}>
                {taxonomy
                  .filter((v) => v.dimension === d.key && v.active)
                  .map((v) => (
                    <option key={v.id} value={`${v.dimension}:${v.slug}`}>
                      {v.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-ink-muted">Ordenar por</span>
          <select name="sort" defaultValue={sort} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-ink hover:bg-border">
          Filtrar
        </button>
      </form>

      <Card className="overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Ninguna publicación coincide con los filtros" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[13px]">
              <thead className="border-b border-border text-left text-[11px] text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-normal">Publicación</th>
                  <th className="px-2 py-3 font-normal">Fecha</th>
                  <th className="px-2 py-3 font-normal">Tipo</th>
                  <th className="px-2 py-3 text-right font-normal">Views</th>
                  <th className="px-2 py-3 text-right font-normal">Reach</th>
                  <th className="px-2 py-3 text-right font-normal">Likes</th>
                  <th className="px-2 py-3 text-right font-normal">Comm.</th>
                  <th className="px-2 py-3 text-right font-normal">Shares</th>
                  <th className="px-2 py-3 text-right font-normal">Saves</th>
                  <th className="px-2 py-3 text-right font-normal">Follows</th>
                  <th className="px-2 py-3 text-right font-normal">Eng.</th>
                  <th className="px-4 py-3 font-normal">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="flex max-w-[320px] gap-3">
                        <PostThumb url={p.thumbnailUrl} type={p.mediaType} size={52} />
                        <p className="line-clamp-3 whitespace-pre-line text-ink-soft">{p.caption}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-ink-soft">
                      {fmtDate(p.publishedAt, { day: "numeric", month: "short", year: "2-digit" })}
                      <div className="text-[11px] text-ink-muted">{fmtTime(p.publishedAt)}</div>
                    </td>
                    <td className="px-2 py-3 text-ink-soft">
                      {p.mediaType}
                      {p.durationSec !== null && <div className="text-[11px] text-ink-muted">{fmtDuration(p.durationSec)}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fmtCompact(p.metrics.views)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fmtCompact(p.metrics.reach)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fmtNumber(p.metrics.likes)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fmtNumber(p.metrics.comments)}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      {fmtNumber(p.metrics.shares)}
                      <div className="text-[10px] text-ink-muted">{fmtNumber(p.rates.sharesPer1k, 1)}/1k</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      {fmtNumber(p.metrics.saves)}
                      <div className="text-[10px] text-ink-muted">{fmtNumber(p.rates.savesPer1k, 1)}/1k</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      {fmtNumber(p.metrics.follows)}
                      <div className="text-[10px] text-ink-muted">{fmtNumber(p.rates.followsPer1k, 2)}/1k</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{fmtRate(p.rates.engagementRate, 1)}</td>
                    <td className="px-4 py-3">
                      {p.tags.length === 0 ? (
                        <Pill tone="coral">sin clasificar</Pill>
                      ) : (
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {TAXONOMY_DIMENSIONS.map((d) => {
                            const t = p.tags.find((x) => x.dimension === d.key);
                            if (!t) return null;
                            return (
                              <span key={d.key} title={`${d.label} · ${t.source === "manual" ? "manual" : `${t.source}, confianza ${Math.round(t.confidence * 100)}%`}`}>
                                <Pill tone={d.key === "topic" ? "accent" : "neutral"}>{t.label}</Pill>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
