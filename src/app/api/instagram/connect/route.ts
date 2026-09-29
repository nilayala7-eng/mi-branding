import { NextResponse } from "next/server";
import { metaOAuthConfig, MetaNotConfiguredError } from "@/lib/meta";
import { buildAuthorizeUrl } from "@/lib/meta/oauth";
import { OAUTH_STATE_COOKIE } from "@/lib/meta/config";
import { createOAuthState } from "@/lib/security/crypto";

/** Starts Business Login for Instagram. */
export async function GET() {
  let cfg;
  try {
    cfg = metaOAuthConfig();
  } catch (e) {
    if (e instanceof MetaNotConfiguredError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const state = createOAuthState(cfg.encryptionKey, "/settings");
  const res = NextResponse.redirect(buildAuthorizeUrl({ appId: cfg.appId, redirectUri: cfg.redirectUri, state }));
  // Bind the flow to this browser (login-CSRF protection): callback must present the same state.
  res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/instagram", maxAge: 600 });
  return res;
}
