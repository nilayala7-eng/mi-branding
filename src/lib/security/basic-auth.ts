/**
 * Single-user access gate for this private app (HTTP Basic auth, checked in
 * src/proxy.ts). Runtime-agnostic (no node:crypto) so it works in Proxy.
 *
 * This is a deliberate Phase-1 measure: it protects the Claude endpoint and
 * the data from the open internet. Supabase Auth replaces it when multi-user
 * or magic-link login is needed (DECISIONS.md D-014).
 */

/** Constant-time string comparison (length leak only). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type AccessDecision = "allow" | "challenge" | "misconfigured";

/**
 * @param header    value of the Authorization header (may be null)
 * @param password  APP_ACCESS_PASSWORD (undefined = not configured)
 * @param isProduction  in production a missing password is a hard error
 */
export function checkBasicAuth(header: string | null, password: string | undefined, isProduction: boolean): AccessDecision {
  if (!password) return isProduction ? "misconfigured" : "allow";
  if (!header?.startsWith("Basic ")) return "challenge";
  let bytes: string;
  try {
    bytes = atob(header.slice(6).trim());
  } catch {
    return "challenge";
  }
  // Browsers send UTF-8 (we ask for it with charset="UTF-8"); older ones Latin-1.
  const utf8 = decodeUtf8(bytes);
  const candidates = utf8 === null ? [bytes] : [utf8, bytes];
  // Username is ignored; only the password matters. Stray spaces are ignored
  // (the configured password is trimmed too).
  const ok = candidates.some((decoded) => {
    const sep = decoded.indexOf(":");
    return sep !== -1 && safeEqual(decoded.slice(sep + 1).trim(), password);
  });
  return ok ? "allow" : "challenge";
}

function decodeUtf8(binary: string): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
