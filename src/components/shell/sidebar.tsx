"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  FlaskConical,
  LayoutDashboard,
  LibraryBig,
  MessageSquareText,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/content", label: "Content", icon: LibraryBig },
  { href: "/strategy", label: "Strategy", icon: Compass },
  { href: "/claude", label: "Claude", icon: MessageSquareText },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ isMock, username }: { isMock: boolean; username: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-border bg-surface/40 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 lg:block">
        <Link href="/overview" className="block">
          <div className="font-display text-[17px] font-bold tracking-[0.18em] text-ink">
            AYALA<span className="text-accent"> OS</span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-ink-muted">
            Instagram Intelligence &amp; Content Strategy
          </div>
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-surface-2 text-ink" : "text-ink-soft hover:bg-surface-2/60 hover:text-ink",
              )}
            >
              <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : undefined} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden px-5 py-5 text-xs text-ink-muted lg:block">
        <div className="text-ink-soft">@{username}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={clsx("h-1.5 w-1.5 rounded-full", isMock ? "bg-warning" : "bg-good")} />
          {isMock ? "Datos de demostración" : "Conectado"}
        </div>
      </div>
    </aside>
  );
}
