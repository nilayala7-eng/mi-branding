/**
 * Meta / Instagram Graph API integration — PHASE 2, BLOCKED ON VERIFICATION.
 *
 * Deliberately empty of endpoint URLs, scopes and metric-per-media-type maps:
 * they must be taken from the live Meta documentation, not from memory
 * (see verification.ts and META_SETUP.md). The sync engine
 * (src/services/instagram/sync.ts) is ready and only needs an
 * `InstagramSource` implementation from this module.
 */
import { metaReadyForIntegration, META_FACTS } from "./verification";

export class MetaIntegrationPendingError extends Error {
  readonly status = 501;
  constructor() {
    super(
      "Instagram integration is not enabled yet: the Meta API flow, permissions and metrics must be verified against the current official documentation first. See META_SETUP.md.",
    );
  }
}

export function assertMetaReady(): void {
  if (!metaReadyForIntegration()) throw new MetaIntegrationPendingError();
}

export { META_FACTS, metaReadyForIntegration };
