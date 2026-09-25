import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "@/server/config";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

function createClient() {
  const config = getConfig();
  return postgres(config.DATABASE_URL, {
    max: config.DB_POOL_SIZE,
    prepare: false,
  });
}

export const sql = globalForDb.postgres ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgres = sql;
}

export const db = drizzle(sql, { schema });
