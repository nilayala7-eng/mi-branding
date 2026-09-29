"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

const MESSAGES: Record<string, string> = {
  connected: "Instagram conectado. Pulsa “Sincronizar ahora” para importar los datos.",
  denied: "Has cancelado el permiso en Instagram.",
  invalid_state: "La conexión caducó o no se inició desde esta app. Vuelve a intentarlo.",
  missing_code: "Instagram no devolvió el código de autorización.",
  missing_permissions: "Conectado, pero faltan permisos (insights). Reconecta y acepta todos los permisos.",
  error: "Error al conectar con Instagram. Revisa META_SETUP.md.",
};

export function InstagramActions({ canConnect, connected, igStatus }: { canConnect: boolean; connected: boolean; igStatus: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "full" | "disconnect">(null);
  const [message, setMessage] = useState<string | null>(igStatus ? MESSAGES[igStatus] ?? null : null);

  async function call(kind: "sync" | "full" | "disconnect") {
    if (kind === "disconnect" && !confirm("¿Desconectar Instagram? Se borra el token; los datos ya importados se conservan.")) return;
    setBusy(kind);
    setMessage(kind === "disconnect" ? null : "Sincronizando… puede tardar unos minutos la primera vez.");
    try {
      const url = kind === "disconnect" ? "/api/instagram/disconnect" : `/api/instagram/sync${kind === "full" ? "?full=1" : ""}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setMessage(
        kind === "disconnect"
          ? "Desconectado."
          : `Sync ${data.status}: ${data.postsCreated} posts nuevos, ${data.postsUpdated} actualizados, ${data.snapshotsWritten} snapshots, ${data.accountDaysWritten} días de cuenta${data.errors?.length ? `, ${data.errors.length} errores` : ""}.`,
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const btn = "rounded-md px-3 py-1.5 text-sm disabled:opacity-50";
  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-2">
        {canConnect ? (
          <a href="/api/instagram/connect" className={`${btn} bg-accent font-medium text-bg hover:bg-accent/90`}>
            {connected ? "Reconectar Instagram" : "Conectar Instagram"}
          </a>
        ) : (
          <span className={`${btn} cursor-not-allowed bg-surface-2 text-ink-muted`}>Conectar Instagram (faltan variables)</span>
        )}
        {connected && (
          <>
            <button onClick={() => call("sync")} disabled={!!busy} className={`${btn} bg-surface-2 text-ink hover:bg-border`}>
              {busy === "sync" ? <LoaderCircle size={14} className="inline animate-spin" /> : "Sincronizar ahora"}
            </button>
            <button onClick={() => call("full")} disabled={!!busy} className={`${btn} bg-surface-2 text-ink-soft hover:bg-border`} title="Refresca las métricas de todas las publicaciones">
              {busy === "full" ? <LoaderCircle size={14} className="inline animate-spin" /> : "Sync completo"}
            </button>
            <button onClick={() => call("disconnect")} disabled={!!busy} className={`${btn} text-ink-muted hover:text-critical`}>
              Desconectar
            </button>
          </>
        )}
      </div>
      {message && <p className="text-xs text-ink-soft" role="status">{message}</p>}
    </div>
  );
}
