import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/basic-auth";
import { syncConnectedAccount, SyncPreconditionError } from "@/services/instagram/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduled sync (vercel.json cron). Excluded from the Basic-auth proxy;
 * protected instead by `Authorization: Bearer <CRON_SECRET>`, which Vercel
 * Cron sends automatically when CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  try {
    const run = await syncConnectedAccount();
    return Response.json({ status: run.status, postsCreated: run.postsCreated, errors: run.errors.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ error: message }, { status: e instanceof SyncPreconditionError ? 409 : 500 });
  }
}
