import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/server/api/errors";

export function verifyHmacSha256(payload: string, signature: string, secret: string) {
  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signature.replace(/^sha256=/, "");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function requireWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined,
) {
  if (!secret) {
    throw new ApiError(
      503,
      "INTEGRATION_NOT_CONFIGURED",
      "Webhook secret is not configured",
    );
  }

  if (!signature || !verifyHmacSha256(payload, signature, secret)) {
    throw new ApiError(401, "INVALID_SIGNATURE", "Webhook signature is invalid");
  }
}
