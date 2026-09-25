export const appEnvs = ["development", "staging", "production"] as const;

export type AppEnv = (typeof appEnvs)[number];

export const environmentProfiles: Record<
  AppEnv,
  {
    cookieSecure: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
    allowDbPush: boolean;
    allowDbSeed: boolean;
    allowDbSetup: boolean;
    exposePlatformHealth: boolean;
    defaultPoolSize: number;
    requireHttps: boolean;
    forbidLoopback: boolean;
    requireSessionSecret: boolean;
    trustProxy: boolean;
    rateLimitWindowSeconds: number;
    rateLimitPublicMax: number;
    rateLimitSensitiveMax: number;
    rateLimitHealthMax: number;
    sessionTtlDays: number;
  }
> = {
  development: {
    cookieSecure: false,
    logLevel: "debug",
    allowDbPush: true,
    allowDbSeed: true,
    allowDbSetup: true,
    exposePlatformHealth: true,
    defaultPoolSize: 10,
    requireHttps: false,
    forbidLoopback: false,
    requireSessionSecret: false,
    trustProxy: false,
    rateLimitWindowSeconds: 60,
    rateLimitPublicMax: 120,
    rateLimitSensitiveMax: 40,
    rateLimitHealthMax: 300,
    sessionTtlDays: 7,
  },
  staging: {
    cookieSecure: true,
    logLevel: "info",
    allowDbPush: true,
    allowDbSeed: true,
    allowDbSetup: true,
    exposePlatformHealth: true,
    defaultPoolSize: 15,
    requireHttps: false,
    forbidLoopback: false,
    requireSessionSecret: true,
    trustProxy: true,
    rateLimitWindowSeconds: 60,
    rateLimitPublicMax: 90,
    rateLimitSensitiveMax: 30,
    rateLimitHealthMax: 300,
    sessionTtlDays: 7,
  },
  production: {
    cookieSecure: true,
    logLevel: "warn",
    allowDbPush: false,
    allowDbSeed: false,
    allowDbSetup: false,
    exposePlatformHealth: false,
    defaultPoolSize: 20,
    requireHttps: true,
    forbidLoopback: true,
    requireSessionSecret: true,
    trustProxy: true,
    rateLimitWindowSeconds: 60,
    rateLimitPublicMax: 60,
    rateLimitSensitiveMax: 20,
    rateLimitHealthMax: 300,
    sessionTtlDays: 14,
  },
};
