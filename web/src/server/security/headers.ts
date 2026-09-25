import { getConfig } from "@/server/config";

export function getSecurityHeaders() {
  const config = getConfig();
  const connectSrc = config.isDevelopment
    ? "'self' ws: wss: http://localhost:3000 http://127.0.0.1:3000"
    : "'self'";

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
    "X-DNS-Prefetch-Control": "off",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com",
      "font-src 'self' data:",
      "media-src 'self' https:",
      "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
      `connect-src ${connectSrc}`,
    ].join("; "),
  };

  if (config.cookieSecure) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}

export function applyHeaders(headers: Headers, extra: Record<string, string>) {
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
}
