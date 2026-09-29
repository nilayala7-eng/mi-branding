import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export function MockBanner() {
  return (
    <div className="border-b border-warning/25 bg-warning/[0.07] px-4 py-2 text-xs text-ink-soft sm:px-8">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <TriangleAlert size={14} className="shrink-0 text-warning" aria-hidden />
        <span>
          <strong className="font-medium text-ink">Datos de demostración.</strong> Todas las cifras son generadas; ningún patrón
          describe tu cuenta real. Instagram se conectará cuando se verifique la API de Meta —{" "}
          <Link href="/settings" className="underline decoration-ink-muted underline-offset-2 hover:text-ink">
            ver estado
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
