import { NextResponse, type NextRequest } from "next/server";
import { saveConnectedAccount } from "@/lib/db/accounts";
import { getSql } from "@/lib/db/client";
import { metaOAuthConfig, MetaNotConfiguredError } from "@/lib/meta";
import { GraphClient } from "@/lib/meta/graph-client";
import { exchangeCodeForToken, exchangeForLongLivedToken } from "@/lib/meta/oauth";
import { getProfile } from "@/lib/meta/source";
import { safeEqual } from "@/lib/security/basic-auth";
import { verifyOAuthState } from "@/lib/security/crypto";
import { OAUTH_STATE_COOKIE } from "@/lib/meta/config";

export const runtime = "nodejs";

function back(request: NextRequest, status: string) {
  const res = NextResponse.redirect(new URL(`/settings?ig=${encodeURIComponent(status)}`, request.url));
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/instagram" });
  return res;
}

/** OAuth callback: verify state → code → short-lived → long-lived → profile → encrypted storage. */
export async function GET(request: NextRequest) {
  let cfg;
  try {
    cfg = metaOAuthConfig();
  } catch (e) {
    if (e instanceof MetaNotConfiguredError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const q = request.nextUrl.searchParams;
  if (q.get("error")) return back(request, q.get("error_reason") === "user_denied" ? "denied" : "error");

  const state = q.get("state") ?? "";
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const verified = verifyOAuthState(state, cfg.encryptionKey);
  if (!verified.ok || !cookieState || !safeEqual(state, cookieState)) return back(request, "invalid_state");

  const code = q.get("code");
  if (!code || code.length > 2048) return back(request, "missing_code");

  try {
    const short = await exchangeCodeForToken({ appId: cfg.appId, appSecret: cfg.appSecret, redirectUri: cfg.redirectUri, code });
    const long = await exchangeForLongLivedToken({ appSecret: cfg.appSecret, shortLivedToken: short.accessToken });
    const profile = await getProfile(new GraphClient(long.accessToken, cfg.graphVersion));
    const missing = ["instagram_business_basic", "instagram_business_manage_insights"].filter((p) => !short.permissions.includes(p));
    await saveConnectedAccount(getSql(), cfg.encryptionKey, {
      igUserId: profile.user_id ?? profile.id ?? short.userId,
      username: profile.username,
      displayName: profile.name ?? null,
      accountType: profile.account_type ?? null,
      profilePictureUrl: profile.profile_picture_url ?? null,
      followersCount: profile.followers_count ?? null,
      mediaCount: profile.media_count ?? null,
      accessToken: long.accessToken,
      tokenExpiresAt: long.expiresAt,
      scopes: short.permissions,
    });
    return back(request, missing.length && short.permissions.length ? "missing_permissions" : "connected");
  } catch (e) {
    console.error("instagram callback failed", e instanceof Error ? e.message : "unknown");
    return back(request, "error");
  }
}
