import { pendingResponse } from "../_pending";

/** Starts the OAuth flow (Phase 2). Will: create signed state → redirect to Meta authorize URL. */
export async function GET() {
  return pendingResponse("connect");
}
