import { pendingResponse } from "../_pending";

/**
 * OAuth callback (Phase 2). Will: verify state (verifyOAuthState) → exchange
 * code → long-lived token → encrypt (encryptSecret) → store → first sync.
 */
export async function GET() {
  return pendingResponse("callback");
}
