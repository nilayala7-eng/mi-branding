import { describe, expect, it } from "vitest";
import { checkBasicAuth, safeEqual } from "./basic-auth";
import { createOAuthState, decryptSecret, encryptSecret, verifyOAuthState } from "./crypto";

const SECRET = "x".repeat(40);
const OTHER = "y".repeat(40);

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips", () => {
    const enc = encryptSecret("IGQVJ-long-lived-token", SECRET);
    expect(enc).not.toContain("IGQVJ");
    expect(decryptSecret(enc, SECRET)).toBe("IGQVJ-long-lived-token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", SECRET)).not.toBe(encryptSecret("same", SECRET));
  });
  it("fails with the wrong key", () => {
    expect(() => decryptSecret(encryptSecret("t", SECRET), OTHER)).toThrow();
  });
  it("detects tampering", () => {
    const [v, iv, tag, ct] = encryptSecret("token", SECRET).split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."), SECRET)).toThrow();
  });
  it("rejects short secrets", () => {
    expect(() => encryptSecret("t", "short")).toThrow(/32/);
  });
});

describe("OAuth state", () => {
  it("verifies a fresh state", () => {
    const s = createOAuthState(SECRET, "/settings", 1_000_000);
    const v = verifyOAuthState(s, SECRET, { now: 1_000_000 + 60_000 });
    expect(v.ok).toBe(true);
  });
  it("rejects expired state", () => {
    const s = createOAuthState(SECRET, "/settings", 1_000_000);
    expect(verifyOAuthState(s, SECRET, { now: 1_000_000 + 11 * 60_000 })).toEqual({ ok: false, reason: "expired" });
  });
  it("rejects a forged or modified state", () => {
    const s = createOAuthState(SECRET);
    expect(verifyOAuthState(s, OTHER)).toEqual({ ok: false, reason: "bad_signature" });
    const [body, sig] = s.split(".");
    expect(verifyOAuthState(`${body}x.${sig}`, SECRET).ok).toBe(false);
    expect(verifyOAuthState("garbage", SECRET)).toEqual({ ok: false, reason: "malformed" });
  });
  it("neutralises open redirects in returnTo", () => {
    for (const bad of ["https://evil.com", "//evil.com"]) {
      const v = verifyOAuthState(createOAuthState(SECRET, bad), SECRET);
      expect(v.ok && v.payload.returnTo).toBe("/settings");
    }
  });
});

describe("basic auth gate", () => {
  const header = (pw: string) => `Basic ${btoa(`nil:${pw}`)}`;
  it("allows the correct password", () => {
    expect(checkBasicAuth(header("s3cret"), "s3cret", true)).toBe("allow");
  });
  it("challenges wrong or missing credentials", () => {
    expect(checkBasicAuth(header("nope"), "s3cret", true)).toBe("challenge");
    expect(checkBasicAuth(null, "s3cret", true)).toBe("challenge");
    expect(checkBasicAuth("Basic !!!", "s3cret", true)).toBe("challenge");
    expect(checkBasicAuth("Bearer abc", "s3cret", true)).toBe("challenge");
  });
  it("passwords containing ':' work", () => {
    expect(checkBasicAuth(header("a:b:c"), "a:b:c", true)).toBe("allow");
  });
  it("accepts non-ASCII passwords (UTF-8 or Latin-1) and ignores stray spaces", () => {
    const utf8 = (pw: string) => `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`nil:${pw}`)))}`;
    expect(checkBasicAuth(utf8("contraseña€"), "contraseña€", true)).toBe("allow");
    expect(checkBasicAuth(header("Año"), "Año", true)).toBe("allow"); // Latin-1 (older browsers)
    expect(checkBasicAuth(header(" s3cret "), "s3cret", true)).toBe("allow");
    expect(checkBasicAuth(utf8("contraseña"), "contrasena", true)).toBe("challenge");
  });
  it("fails closed in production when unconfigured, open in dev", () => {
    expect(checkBasicAuth(null, undefined, true)).toBe("misconfigured");
    expect(checkBasicAuth(null, undefined, false)).toBe("allow");
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
