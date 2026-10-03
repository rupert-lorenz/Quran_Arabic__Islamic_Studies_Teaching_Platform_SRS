export type MobileClient = "ios" | "android";

export function mobileClient(request: Request): MobileClient | null {
  const value = request.headers.get("x-alharamain-client");
  return value === "ios" || value === "android" ? value : null;
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(header.trim());
  return match?.[1] ?? null;
}
