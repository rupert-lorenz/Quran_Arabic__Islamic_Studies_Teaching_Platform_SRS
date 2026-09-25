import { getConfig } from "@/server/config";
import { redis } from "./client";

export type RateLimitKind = "public" | "sensitive" | "health" | "webhook";

function maxFor(kind: RateLimitKind) {
  const config = getConfig();

  switch (kind) {
    case "sensitive":
      return config.rateLimitSensitiveMax;
    case "health":
      return config.rateLimitHealthMax;
    case "webhook":
      return config.rateLimitPublicMax * 2;
    default:
      return config.rateLimitPublicMax;
  }
}

export async function consumeRateLimit(kind: RateLimitKind, key: string) {
  const config = getConfig();
  const redisKey = `rate:${kind}:${key}`;
  const count = await redis.incr(redisKey);

  if (count === 1) {
    await redis.expire(redisKey, config.rateLimitWindowSeconds);
  }

  const limit = maxFor(kind);
  const ttl = await redis.ttl(redisKey);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: ttl > 0 ? ttl : config.rateLimitWindowSeconds,
  };
}
