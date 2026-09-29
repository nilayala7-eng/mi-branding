import { pendingResponse } from "../_pending";

/** Triggers runSync() for the connected account (Phase 2; also a Vercel Cron target). */
export async function POST() {
  return pendingResponse("sync");
}
