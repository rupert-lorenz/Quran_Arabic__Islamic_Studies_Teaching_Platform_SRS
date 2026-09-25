import { createHash, randomUUID } from "node:crypto";
import { getConfig } from "@/server/config";
import { REQUEST_ID_HEADER } from "./constants";

export { REQUEST_ID_HEADER, SESSION_COOKIE_NAME } from "./constants";

export function getRequestId(request: Request) {
  return request.headers.get(REQUEST_ID_HEADER)?.trim() || randomUUID();
}

export function getClientIp(request: Request) {
  const config = getConfig();

  if (config.trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }

  return "127.0.0.1";
}

export function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 512) ?? "";
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return undefined;
}
