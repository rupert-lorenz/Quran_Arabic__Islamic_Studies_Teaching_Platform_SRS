import { count } from "drizzle-orm";
import { getConfig } from "@/server/config";
import { platformModules } from "@/server/architecture";
import { db, sql } from "./index";
import {
  cmsDocuments,
  countries,
  currencies,
  fxRates,
  locales,
  permissions,
  roles,
  sessions,
  subjects,
  translations,
  users,
} from "./schema";

export type DatabaseStatus =
  | {
      ok: true;
      env: string;
      database: string;
      modules?: typeof platformModules;
      counts?: Record<string, number>;
    }
  | {
      ok: false;
      error: string;
    };

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    const config = getConfig();
    const [info] = await sql<{ current_database: string }[]>`
      select current_database()
    `;

    const tables = {
      roles,
      users,
      sessions,
      countries,
      currencies,
      fxRates,
      locales,
      subjects,
      permissions,
      translations,
      cmsDocuments,
    } as const;

    const counts = Object.fromEntries(
      await Promise.all(
        Object.entries(tables).map(async ([name, table]) => {
          const [row] = await db.select({ value: count() }).from(table);
          return [name, Number(row?.value ?? 0)];
        }),
      ),
    );

    if (!config.exposePlatformHealth) {
      return {
        ok: true,
        env: config.APP_ENV,
        database: info?.current_database ?? "unknown",
      };
    }

    return {
      ok: true,
      env: config.APP_ENV,
      database: info?.current_database ?? "unknown",
      modules: platformModules,
      counts,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not connect to PostgreSQL",
    };
  }
}
