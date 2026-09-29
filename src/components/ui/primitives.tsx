import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Confidence } from "@/lib/domain/types";
import { fmtDelta } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Card({
  className,
  children,
  as: Tag = "section",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={clsx("rounded-2xl border border-border bg-surface", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  eyebrow,
  description,
  right,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</div>}
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * Change indicator. `goodWhen` decides colour: for unfollows a drop is good.
 * Always sign + icon + text, never colour alone.
 */
export function Delta({
  value,
  goodWhen = "up",
  className,
}: {
  value: number | null;
  goodWhen?: "up" | "down";
  className?: string;
}) {
  if (value === null) return <span className={clsx("text-xs text-ink-muted", className)}>sin comparación</span>;
  const flat = Math.abs(value) < 0.005;
  const up = value > 0;
  const good = flat ? null : goodWhen === "up" ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        good === null ? "text-ink-muted" : good ? "text-good" : "text-critical",
        className,
      )}
    >
      <Icon size={13} strokeWidth={2} aria-hidden />
      {fmtDelta(value)}
    </span>
  );
}

const CONFIDENCE_STYLE: Record<Confidence, { label: string; className: string }> = {
  insufficient: { label: "Muestra insuficiente", className: "border-border-strong text-ink-muted" },
  low: { label: "Confianza baja", className: "border-warning/40 text-warning" },
  medium: { label: "Confianza media", className: "border-[#3987e5]/40 text-[#7fb0ef]" },
  high: { label: "Confianza alta", className: "border-good/40 text-good" },
};

export function ConfidenceBadge({ confidence, n }: { confidence: Confidence; n?: number }) {
  const s = CONFIDENCE_STYLE[confidence];
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]", s.className)}>
      {s.label}
      {n !== undefined && <span className="text-ink-muted">· n={n}</span>}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "coral" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none",
        tone === "neutral" && "bg-surface-2 text-ink-soft",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "coral" && "bg-coral-soft text-coral",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-5 py-8 text-center">
      <div className="text-sm font-medium text-ink-soft">{title}</div>
      {children && <div className="mt-1 text-xs text-ink-muted">{children}</div>}
    </div>
  );
}
