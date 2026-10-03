import { Redis } from "ioredis";
import { getConfig } from "@/server/config";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisMemory?: MemoryStore;
};

function getRedisUrl() {
  return getConfig().REDIS_URL;
}

class MemoryStore {
  private values = new Map<string, { value: string; expiresAt: number | null }>();
  private sets = new Map<string, { members: Set<string>; expiresAt: number | null }>();

  private liveValue(key: string) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry;
  }

  private liveSet(key: string) {
    const entry = this.sets.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      this.sets.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string) {
    return this.liveValue(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: Array<string | number>) {
    let expiresAt: number | null = null;
    let onlyIfMissing = false;

    for (let index = 0; index < args.length; index += 1) {
      const flag = String(args[index]).toUpperCase();
      if (flag === "EX") {
        expiresAt = Date.now() + Number(args[index + 1]) * 1000;
        index += 1;
      } else if (flag === "PX") {
        expiresAt = Date.now() + Number(args[index + 1]);
        index += 1;
      } else if (flag === "NX") {
        onlyIfMissing = true;
      }
    }

    if (onlyIfMissing && this.liveValue(key)) {
      return null;
    }

    this.values.set(key, { value, expiresAt });
    return "OK";
  }

  async del(...keys: string[]) {
    let removed = 0;
    for (const key of keys) {
      const hadValue = this.values.delete(key);
      const hadSet = this.sets.delete(key);
      if (hadValue || hadSet) removed += 1;
    }
    return removed;
  }

  async incr(key: string) {
    const current = Number(this.liveValue(key)?.value ?? 0);
    const next = (Number.isFinite(current) ? current : 0) + 1;
    const expiresAt = this.values.get(key)?.expiresAt ?? null;
    this.values.set(key, { value: String(next), expiresAt });
    return next;
  }

  async expire(key: string, seconds: number) {
    const expiresAt = Date.now() + seconds * 1000;
    const value = this.liveValue(key);
    if (value) {
      value.expiresAt = expiresAt;
      return 1;
    }
    const set = this.liveSet(key);
    if (set) {
      set.expiresAt = expiresAt;
      return 1;
    }
    return 0;
  }

  async ttl(key: string) {
    const value = this.liveValue(key);
    if (!value) return -2;
    if (value.expiresAt == null) return -1;
    return Math.max(0, Math.ceil((value.expiresAt - Date.now()) / 1000));
  }

  async sadd(key: string, ...members: string[]) {
    let set = this.liveSet(key);
    if (!set) {
      set = { members: new Set(), expiresAt: null };
      this.sets.set(key, set);
    }
    let added = 0;
    for (const member of members) {
      if (!set.members.has(member)) {
        set.members.add(member);
        added += 1;
      }
    }
    return added;
  }

  async smembers(key: string) {
    return [...(this.liveSet(key)?.members ?? [])];
  }

  async eval(script: string, keyCount: number, ...args: Array<string | number>) {
    const keys = args.slice(0, keyCount).map(String);
    const values = args.slice(keyCount).map(String);
    if (script.includes('redis.call("get"') && script.includes('redis.call("del"')) {
      if ((await this.get(keys[0])) === values[0]) {
        await this.del(keys[0]);
        return 1;
      }
      return 0;
    }
    throw new Error("Redis is not connected");
  }
}

function createClient() {
  const client = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
    enableOfflineQueue: false,
    connectTimeout: 1000,
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },
  });
  client.on("error", () => undefined);
  return client;
}

function createFacade(client: Redis, memory: MemoryStore) {
  const memoryCommands = new Set([
    "get",
    "set",
    "del",
    "incr",
    "expire",
    "ttl",
    "sadd",
    "smembers",
    "eval",
  ]);

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (
        typeof prop === "string" &&
        target.status !== "ready" &&
        memoryCommands.has(prop)
      ) {
        const method = memory[prop as keyof MemoryStore];
        return method.bind(memory);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const client = globalForRedis.redis ?? createClient();
const memory = globalForRedis.redisMemory ?? new MemoryStore();
globalForRedis.redis = client;
globalForRedis.redisMemory = memory;

export const redis = createFacade(client, memory);
