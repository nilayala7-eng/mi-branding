/** Business Login for Instagram — code → short-lived → long-lived token. */
import { z } from "zod";
import { parseGraphResponse, type FetchLike } from "./graph-client";
import { IG_AUTHORIZE_URL, IG_LONG_LIVED_URL, IG_REFRESH_URL, IG_SCOPES, IG_TOKEN_URL } from "./config";

export function buildAuthorizeUrl(opts: { appId: string; redirectUri: string; state: string }): string {
  const u = new URL(IG_AUTHORIZE_URL);
  u.searchParams.set("client_id", opts.appId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", opts.state);
  return u.toString();
}

/** Meta appends "#_" to the redirect; it is not part of the code. */
export function cleanAuthCode(code: string): string {
  return code.replace(/#_$/, "").trim();
}

const shortLivedSchema = z.object({
  data: z
    .array(z.object({ access_token: z.string().min(1), user_id: z.union([z.string(), z.number()]).transform(String), permissions: z.string().default("") }))
    .min(1),
});
// Some responses are documented un-wrapped in older guides; accept both shapes.
const shortLivedFlatSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.union([z.string(), z.number()]).transform(String),
  permissions: z.union([z.string(), z.array(z.string())]).optional(),
});

export interface ShortLivedToken {
  accessToken: string;
  userId: string;
  permissions: string[];
}

export async function exchangeCodeForToken(
  opts: { appId: string; appSecret: string; redirectUri: string; code: string },
  fetchImpl: FetchLike = fetch,
): Promise<ShortLivedToken> {
  const form = new FormData();
  form.set("client_id", opts.appId);
  form.set("client_secret", opts.appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", opts.redirectUri);
  form.set("code", cleanAuthCode(opts.code));
  const body = await parseGraphResponse<unknown>(await fetchImpl(IG_TOKEN_URL, { method: "POST", body: form, cache: "no-store" }));
  const wrapped = shortLivedSchema.safeParse(body);
  if (wrapped.success) {
    const t = wrapped.data.data[0];
    return { accessToken: t.access_token, userId: t.user_id, permissions: t.permissions.split(",").filter(Boolean) };
  }
  const flat = shortLivedFlatSchema.parse(body);
  const perms = Array.isArray(flat.permissions) ? flat.permissions : (flat.permissions ?? "").split(",").filter(Boolean);
  return { accessToken: flat.access_token, userId: flat.user_id, permissions: perms };
}

const longLivedSchema = z.object({ access_token: z.string().min(1), token_type: z.string().optional(), expires_in: z.number().int().positive() });

export interface LongLivedToken {
  accessToken: string;
  expiresAt: Date;
}

async function longLivedCall(url: URL, fetchImpl: FetchLike, now: number): Promise<LongLivedToken> {
  const body = longLivedSchema.parse(await parseGraphResponse(await fetchImpl(url.toString(), { cache: "no-store" })));
  return { accessToken: body.access_token, expiresAt: new Date(now + body.expires_in * 1000) };
}

export function exchangeForLongLivedToken(
  opts: { appSecret: string; shortLivedToken: string },
  fetchImpl: FetchLike = fetch,
  now = Date.now(),
): Promise<LongLivedToken> {
  const u = new URL(IG_LONG_LIVED_URL);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", opts.appSecret);
  u.searchParams.set("access_token", opts.shortLivedToken);
  return longLivedCall(u, fetchImpl, now);
}

export function refreshLongLivedToken(token: string, fetchImpl: FetchLike = fetch, now = Date.now()): Promise<LongLivedToken> {
  const u = new URL(IG_REFRESH_URL);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", token);
  return longLivedCall(u, fetchImpl, now);
}
