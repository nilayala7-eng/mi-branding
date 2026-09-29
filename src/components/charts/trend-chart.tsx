"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtCompact, fmtNumber, fmtRate } from "@/lib/format";

export interface TrendPoint {
  /** Label for the current-period bucket (e.g. "3 sept"). */
  label: string;
  /** Label for the aligned previous-period bucket. */
  previousLabel?: string;
  current: number | null;
  previous?: number | null;
}

type ValueFormat = "number" | "rate" | "decimal";

const formatValue = (v: number | null | undefined, f: ValueFormat) =>
  v === null || v === undefined ? "—" : f === "rate" ? fmtRate(v) : f === "decimal" ? fmtNumber(v, 2) : fmtNumber(v);

function ChartTooltip({ active, payload, format }: TooltipContentProps<number, string> & { format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as TrendPoint;
  return (
    <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded bg-[var(--series-1)]" />
        <span className="text-ink-muted">{point.label}</span>
        <span className="ml-auto pl-4 font-medium text-ink">{formatValue(point.current, format)}</span>
      </div>
      {point.previous !== undefined && (
        <div className="mt-1 flex items-center gap-2">
          <span className="h-0.5 w-3 rounded border-t border-dashed border-[var(--series-previous)]" />
          <span className="text-ink-muted">{point.previousLabel ?? "Anterior"}</span>
          <span className="ml-auto pl-4 text-ink-soft">{formatValue(point.previous, format)}</span>
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  data,
  format = "number",
  height = 180,
  showPrevious = true,
  ariaLabel,
}: {
  data: TrendPoint[];
  format?: ValueFormat;
  height?: number;
  showPrevious?: boolean;
  ariaLabel: string;
}) {
  const tick = (v: number) => (format === "rate" ? `${Math.round(v * 1000) / 10}%` : fmtCompact(v));
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickFormatter={tick}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} format={format} />}
          />
          {showPrevious && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--series-previous)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              connectNulls
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="current"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)" }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLegend({ previousLabel = "Periodo anterior" }: { previousLabel?: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3.5 rounded bg-[var(--series-1)]" />
        Actual
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 border-t-[1.5px] border-dashed border-[var(--series-previous)]" />
        {previousLabel}
      </span>
    </div>
  );
}
