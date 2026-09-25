import { getConfig } from "@/server/config";
import { ApiError } from "./errors";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: Request) {
  if (safeMethods.has(request.method)) {
    return;
  }

  const allowed = new Set(getConfig().corsOrigins);
  const origin = request.headers.get("origin");

  if (origin) {
    if (!allowed.has(origin)) {
      throw new ApiError(403, "CSRF_ORIGIN", "Request origin is not allowed");
    }
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) {
        return;
      }
    } catch {
      throw new ApiError(403, "CSRF_ORIGIN", "Request origin is not allowed");
    }
  }

  throw new ApiError(403, "CSRF_ORIGIN", "Request origin is not allowed");
}

export function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && getConfig().corsOrigins.includes(origin)) {
    return origin;
  }

  return null;
}
