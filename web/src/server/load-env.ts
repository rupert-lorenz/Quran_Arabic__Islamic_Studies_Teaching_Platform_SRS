import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, parse } from "dotenv";

const appEnvs = ["development", "staging", "production"] as const;

function peekAppEnv(cwd: string): (typeof appEnvs)[number] {
  if (process.env.APP_ENV && appEnvs.includes(process.env.APP_ENV as (typeof appEnvs)[number])) {
    return process.env.APP_ENV as (typeof appEnvs)[number];
  }

  for (const file of [".env.local", ".env"]) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    const value = parse(readFileSync(path)).APP_ENV;
    if (value && appEnvs.includes(value as (typeof appEnvs)[number])) {
      return value as (typeof appEnvs)[number];
    }
  }

  return "development";
}

export function loadEnv(cwd = process.cwd()) {
  const appEnv = peekAppEnv(cwd);
  const files = [
    `.env.${appEnv}.local`,
    appEnv === "development" ? ".env.local" : null,
    `.env.${appEnv}`,
    ".env",
  ].filter((file): file is string => Boolean(file));

  for (const file of files) {
    const path = resolve(cwd, file);
    if (existsSync(path)) {
      config({ path, override: false, quiet: true });
    }
  }

  if (!process.env.APP_ENV) {
    process.env.APP_ENV = appEnv;
  }
}
