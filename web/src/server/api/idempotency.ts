import { redis } from "@/redis/client";
import { ApiError } from "./errors";

export async function reserveIdempotencyKey(key: string, ttlSeconds = 24 * 60 * 60) {
  const normalized = key.trim();
  if (!normalized || normalized.length > 128) {
    throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key is invalid");
  }

  const created = await redis.set(`idempotency:${normalized}`, "1", "EX", ttlSeconds, "NX");
  return created === "OK";
}
