import { Redis } from "ioredis";
import { getConfig } from "@/server/config";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function getRedisUrl() {
  return getConfig().REDIS_URL;
}

function createClient() {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
