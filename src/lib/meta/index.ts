/**
 * Meta / Instagram Graph API integration (Instagram API with Instagram Login).
 * Verified against the official docs on 2026-09-29 — see verification.ts.
 */
import { serverEnv } from "@/lib/env";

export class MetaNotConfiguredError extends Error {
  readonly status = 503;
}

/** Everything the OAuth flow needs, or a clear error naming what is missing. */
export function metaOAuthConfig() {
  const env = serverEnv();
  const missing = [
    !env.META_APP_ID && "META_APP_ID",
    !env.META_APP_SECRET && "META_APP_SECRET",
    !env.APP_ENCRYPTION_KEY && "APP_ENCRYPTION_KEY",
    env.DATA_SOURCE !== "supabase" && "DATA_SOURCE=supabase",
    !env.DATABASE_URL && "DATABASE_URL",
  ].filter(Boolean);
  if (missing.length) throw new MetaNotConfiguredError(`Instagram connection not configured. Missing: ${missing.join(", ")}. See META_SETUP.md.`);
  return {
    appId: env.META_APP_ID!,
    appSecret: env.META_APP_SECRET!,
    encryptionKey: env.APP_ENCRYPTION_KEY!,
    redirectUri: `${env.APP_URL.replace(/\/$/, "")}/api/instagram/callback`,
    graphVersion: env.META_GRAPH_API_VERSION,
  };
}

export { META_FACTS, metaReadyForIntegration } from "./verification";
