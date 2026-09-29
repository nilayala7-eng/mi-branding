import { GraphApiError } from "@/lib/meta/graph-client";
import { syncConnectedAccount, SyncPreconditionError } from "@/services/instagram/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Manual "Sync now" (behind the app password via proxy). ?full=1 refreshes every post. */
export async function POST(request: Request) {
  const full = new URL(request.url).searchParams.get("full") === "1";
  try {
    const run = await syncConnectedAccount({ full });
    return Response.json(run);
  } catch (e) {
    if (e instanceof SyncPreconditionError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof GraphApiError) return Response.json({ error: e.message, code: e.code }, { status: 502 });
    console.error("sync failed", e instanceof Error ? e.message : e);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
