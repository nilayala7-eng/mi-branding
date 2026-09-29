import clsx from "clsx";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { TAXONOMY_DIMENSIONS } from "@/lib/data/taxonomy-seed";
import { integrationStatus } from "@/lib/env";
import { META_FACTS, type VerificationLevel } from "@/lib/meta/verification";

const LEVEL: Record<VerificationLevel, { label: string; className: string }> = {
  verified: { label: "Verificado", className: "text-good" },
  sdk: { label: "SDK oficial", className: "text-[#7fb0ef]" },
  search: { label: "Solo búsqueda", className: "text-warning" },
  unverified: { label: "Sin verificar", className: "text-critical" },
};

function Status({ ok, pending, label, detail }: { ok: boolean; pending?: boolean; label: string; detail: React.ReactNode }) {
  const Icon = ok ? CircleCheck : pending ? CircleDashed : CircleX;
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon size={18} className={clsx("mt-0.5 shrink-0", ok ? "text-good" : pending ? "text-warning" : "text-ink-muted")} aria-hidden />
      <div className="min-w-0">
        <div className="text-sm text-ink">
          {label} <span className="sr-only">{ok ? "(correcto)" : "(pendiente)"}</span>
        </div>
        <div className="text-xs text-ink-muted">{detail}</div>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const repo = getRepository();
  const [account, taxonomy] = await Promise.all([repo.getAccount(), repo.getTaxonomy()]);
  const s = integrationStatus();
  const verified = META_FACTS.filter((f) => f.level === "verified").length;

  return (
    <>
      <PageHeader title="Settings" subtitle="Conexiones, estado de sincronización y taxonomía de contenido." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Conexiones" />
          <div className="divide-y divide-border px-5 pb-2">
            <Status
              ok={false}
              pending
              label="Instagram (Meta Graph API)"
              detail={
                <>
                  Pendiente de verificación de la documentación oficial ({verified}/{META_FACTS.length} hechos verificados). La conexión se
                  habilitará después. Guía: META_SETUP.md. App de Meta configurada: {s.metaConfigured ? "sí" : "no"} · Graph API{" "}
                  {s.graphApiVersion}.
                </>
              }
            />
            <Status
              ok={s.claudeConfigured}
              label="Claude API"
              detail={s.claudeConfigured ? `Modelo: ${s.claudeModel}` : "Falta ANTHROPIC_API_KEY (CLAUDE_SETUP.md)"}
            />
            <Status
              ok={s.supabaseConfigured}
              pending={!s.supabaseConfigured}
              label="Supabase (PostgreSQL)"
              detail={`Fuente de datos activa: ${s.dataSource}. ${s.supabaseConfigured ? "Credenciales presentes." : "Sin configurar (Fase 2)."}`}
            />
            <Status
              ok={s.accessPasswordConfigured}
              label="Contraseña de acceso"
              detail={s.accessPasswordConfigured ? "APP_ACCESS_PASSWORD activa" : "Sin APP_ACCESS_PASSWORD: abierto en desarrollo, bloqueado en producción"}
            />
            <Status
              ok={s.encryptionConfigured}
              label="Cifrado de tokens"
              detail={s.encryptionConfigured ? "APP_ENCRYPTION_KEY presente" : "Falta APP_ENCRYPTION_KEY (≥ 32 caracteres); necesaria antes de conectar Instagram"}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Sincronización" description="Idempotente: re-sincronizar actualiza, nunca duplica." />
          <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Cuenta</dt>
              <dd>@{account.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Estado</dt>
              <dd>{account.connectionStatus}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Última sincronización</dt>
              <dd>{account.lastSyncAt ?? "nunca"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Último error</dt>
              <dd className="text-ink-soft">{account.lastSyncError ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Estado de verificación de la API de Meta"
            description="Nada se implementa contra Meta hasta que cada punto esté verificado en la documentación oficial vigente."
          />
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="text-left text-[11px] text-ink-muted">
                <tr>
                  <th className="pb-2 font-normal">Tema</th>
                  <th className="pb-2 font-normal">Afirmación</th>
                  <th className="pb-2 font-normal">Nivel</th>
                  <th className="pb-2 font-normal">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {META_FACTS.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 pr-3 text-ink-muted">{f.topic}</td>
                    <td className="py-2 pr-3 text-ink-soft">{f.claim}</td>
                    <td className={clsx("whitespace-nowrap py-2 pr-3", LEVEL[f.level].className)}>{LEVEL[f.level].label}</td>
                    <td className="py-2 text-xs text-ink-muted">{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Taxonomía de contenido"
            description="Categorías como datos (tabla taxonomy_values), no como código. La edición desde aquí llega con Supabase (Fase 2)."
          />
          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
            {TAXONOMY_DIMENSIONS.map((d) => (
              <div key={d.key}>
                <div className="text-sm text-ink">{d.label}</div>
                <div className="mb-2 text-[11px] text-ink-muted">{d.description}</div>
                <div className="flex flex-wrap gap-1">
                  {taxonomy
                    .filter((v) => v.dimension === d.key)
                    .map((v) => (
                      <Pill key={v.id}>{v.label}</Pill>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
