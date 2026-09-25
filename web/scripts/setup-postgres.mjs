import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, parse } from "dotenv";
import postgres from "postgres";

const appEnvs = ["development", "staging", "production"];
let appEnv = process.env.APP_ENV;
if (!appEnv || !appEnvs.includes(appEnv)) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const value = parse(readFileSync(path)).APP_ENV;
    if (value && appEnvs.includes(value)) {
      appEnv = value;
      break;
    }
  }
}
appEnv ??= "development";

for (const file of [
  `.env.${appEnv}.local`,
  appEnv === "development" ? ".env.local" : null,
  `.env.${appEnv}`,
  ".env",
].filter(Boolean)) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) config({ path, override: false, quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.POSTGRES_PASSWORD;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

if (!adminPassword) {
  throw new Error(
    "Set POSTGRES_PASSWORD in web/.env.local or web/.env to the local postgres superuser password, then run pnpm db:setup again.",
  );
}

const appUrl = new URL(databaseUrl);
const appUser = decodeURIComponent(appUrl.username);
const appPassword = decodeURIComponent(appUrl.password);
const appDatabase = appUrl.pathname.replace(/^\//, "");

if (!appUser || !appPassword || !appDatabase) {
  throw new Error("DATABASE_URL must include username, password, and database name");
}

const admin = postgres({
  host: appUrl.hostname,
  port: Number(appUrl.port || 5432),
  user: "postgres",
  password: adminPassword,
  database: "postgres",
  max: 1,
});

function quoteIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

try {
  const [role] = await admin`
    select 1 as exists
    from pg_roles
    where rolname = ${appUser}
  `;

  if (!role) {
    await admin.unsafe(
      `create role ${quoteIdent(appUser)} login password '${appPassword.replaceAll("'", "''")}'`,
    );
    console.log(`Created role ${appUser}`);
  } else {
    await admin.unsafe(
      `alter role ${quoteIdent(appUser)} with login password '${appPassword.replaceAll("'", "''")}'`,
    );
    console.log(`Updated role ${appUser}`);
  }

  const [database] = await admin`
    select 1 as exists
    from pg_database
    where datname = ${appDatabase}
  `;

  if (!database) {
    await admin.unsafe(
      `create database ${quoteIdent(appDatabase)} owner ${quoteIdent(appUser)}`,
    );
    console.log(`Created database ${appDatabase}`);
  } else {
    console.log(`Database ${appDatabase} already exists`);
  }

  await admin.unsafe(
    `grant all privileges on database ${quoteIdent(appDatabase)} to ${quoteIdent(appUser)}`,
  );
} finally {
  await admin.end({ timeout: 5 });
}
