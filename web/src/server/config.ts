import { z } from "zod";
import { type AppEnv, appEnvs, environmentProfiles } from "./environment";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z.enum(appEnvs).default("development"),
  APP_NAME: z.string().min(1).default("Al Haramain Schools"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).optional(),
  SESSION_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  ALLOW_DESTRUCTIVE_DB: z.enum(["true", "false"]).optional(),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).optional(),
});

export type AppConfig = {
  NODE_ENV: "development" | "test" | "production";
  APP_ENV: AppEnv;
  APP_NAME: string;
  APP_URL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  DB_POOL_SIZE: number;
  SESSION_SECRET?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  cookieSecure: boolean;
  allowDbPush: boolean;
  allowDbSeed: boolean;
  allowDbSetup: boolean;
  exposePlatformHealth: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  isLive: boolean;
  corsOrigins: string[];
  trustProxy: boolean;
  rateLimitWindowSeconds: number;
  rateLimitPublicMax: number;
  rateLimitSensitiveMax: number;
  rateLimitHealthMax: number;
  sessionTtlSeconds: number;
};

let cached: AppConfig | undefined;

function isLoopbackUrl(value: string) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function parseOrigins(appUrl: string, extra?: string) {
  const origins = new Set<string>([new URL(appUrl).origin]);

  for (const value of extra?.split(",") ?? []) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    origins.add(new URL(trimmed).origin);
  }

  return [...origins];
}

function hostOf(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

function parseEnv() {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    APP_NAME: process.env.APP_NAME,
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    DB_POOL_SIZE: process.env.DB_POOL_SIZE,
    SESSION_SECRET: process.env.SESSION_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    COOKIE_SECURE: process.env.COOKIE_SECURE,
    ALLOW_DESTRUCTIVE_DB: process.env.ALLOW_DESTRUCTIVE_DB,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    TRUST_PROXY: process.env.TRUST_PROXY,
    SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const data = parsed.data;
  const profile = environmentProfiles[data.APP_ENV];
  const allowDestructive = data.ALLOW_DESTRUCTIVE_DB === "true";
  const issues: string[] = [];

  if (profile.requireHttps && !data.APP_URL.startsWith("https://")) {
    issues.push("APP_URL must use HTTPS in this environment");
  }

  if (profile.forbidLoopback && isLoopbackUrl(data.APP_URL)) {
    issues.push("APP_URL cannot be localhost in this environment");
  }

  if (profile.forbidLoopback && isLoopbackUrl(data.DATABASE_URL)) {
    issues.push("DATABASE_URL cannot be localhost in this environment");
  }

  if (profile.forbidLoopback && isLoopbackUrl(data.REDIS_URL)) {
    issues.push("REDIS_URL cannot be localhost in this environment");
  }

  if (profile.requireSessionSecret && (data.SESSION_SECRET?.length ?? 0) < 32) {
    issues.push("SESSION_SECRET must be at least 32 characters in this environment");
  }

  if (issues.length > 0) {
    throw new Error(`Invalid ${data.APP_ENV} environment: ${issues.join("; ")}`);
  }

  return {
    NODE_ENV: data.NODE_ENV,
    APP_ENV: data.APP_ENV,
    APP_NAME: data.APP_NAME,
    APP_URL: data.APP_URL,
    DATABASE_URL: data.DATABASE_URL,
    REDIS_URL: data.REDIS_URL,
    DB_POOL_SIZE: data.DB_POOL_SIZE ?? profile.defaultPoolSize,
    SESSION_SECRET: data.SESSION_SECRET,
    logLevel: data.LOG_LEVEL ?? profile.logLevel,
    cookieSecure:
      data.COOKIE_SECURE !== undefined
        ? data.COOKIE_SECURE === "true"
        : profile.cookieSecure,
    allowDbPush: profile.allowDbPush || allowDestructive,
    allowDbSeed: profile.allowDbSeed || allowDestructive,
    allowDbSetup: profile.allowDbSetup || allowDestructive,
    exposePlatformHealth: profile.exposePlatformHealth,
    isDevelopment: data.APP_ENV === "development",
    isStaging: data.APP_ENV === "staging",
    isProduction: data.APP_ENV === "production",
    isLive: data.APP_ENV === "staging" || data.APP_ENV === "production",
    corsOrigins: parseOrigins(data.APP_URL, data.CORS_ORIGINS),
    trustProxy:
      data.TRUST_PROXY !== undefined
        ? data.TRUST_PROXY === "true"
        : profile.trustProxy,
    rateLimitWindowSeconds: profile.rateLimitWindowSeconds,
    rateLimitPublicMax: profile.rateLimitPublicMax,
    rateLimitSensitiveMax: profile.rateLimitSensitiveMax,
    rateLimitHealthMax: profile.rateLimitHealthMax,
    sessionTtlSeconds:
      (data.SESSION_TTL_DAYS ?? profile.sessionTtlDays) * 24 * 60 * 60,
  } satisfies AppConfig;
}

export function getConfig(): AppConfig {
  if (!cached) {
    cached = parseEnv();
  }

  return cached;
}

export function resetConfigCache() {
  cached = undefined;
}

export function getPublicConfig(config = getConfig()) {
  return {
    APP_ENV: config.APP_ENV,
    NODE_ENV: config.NODE_ENV,
    APP_NAME: config.APP_NAME,
    APP_URL: config.APP_URL,
    databaseHost: hostOf(config.DATABASE_URL),
    redisHost: hostOf(config.REDIS_URL),
    DB_POOL_SIZE: config.DB_POOL_SIZE,
    logLevel: config.logLevel,
    cookieSecure: config.cookieSecure,
    allowDbPush: config.allowDbPush,
    allowDbSeed: config.allowDbSeed,
    allowDbSetup: config.allowDbSetup,
    exposePlatformHealth: config.exposePlatformHealth,
    corsOrigins: config.corsOrigins,
    trustProxy: config.trustProxy,
    rateLimitWindowSeconds: config.rateLimitWindowSeconds,
  };
}
