import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/security/basic-auth";

/**
 * Protects every page and API route with APP_ACCESS_PASSWORD.
 * Not configured → open in development, 503 in production (fail closed).
 */
export function proxy(request: NextRequest) {
  const decision = checkBasicAuth(
    request.headers.get("authorization"),
    process.env.APP_ACCESS_PASSWORD?.trim() || undefined,
    process.env.NODE_ENV === "production",
  );
  if (decision === "allow") return NextResponse.next();
  if (decision === "misconfigured") {
    return new NextResponse("APP_ACCESS_PASSWORD is not configured. See SETUP.md.", { status: 503 });
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ayala OS", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except static assets. The Instagram OAuth callback is also
  // protected: the browser sends the Basic credentials on the redirect.
  // /api/cron/* is authenticated with CRON_SECRET inside the route instead.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
};
