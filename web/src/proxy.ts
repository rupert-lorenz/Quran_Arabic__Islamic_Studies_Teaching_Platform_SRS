import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOrigin } from "@/server/api/csrf";
import { REQUEST_ID_HEADER } from "@/server/api/constants";
import { applyHeaders, getSecurityHeaders } from "@/server/security/headers";

export function proxy(request: NextRequest) {
  const requestId = request.headers.get(REQUEST_ID_HEADER)?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applyHeaders(response.headers, getSecurityHeaders());
  response.headers.set(REQUEST_ID_HEADER, requestId);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = getAllowedOrigin(request);
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Request-ID, Idempotency-Key",
      );
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      response.headers.set("Access-Control-Max-Age", "600");
    }

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
