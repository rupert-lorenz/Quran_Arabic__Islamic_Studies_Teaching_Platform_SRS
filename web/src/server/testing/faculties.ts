import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classrooms,
  currencies,
  files,
  locales,
  permissions,
  rolePermissions,
  roles,
  users,
} from "@/db/schema";
import { redis } from "@/redis/client";
import { getConfig } from "@/server/config";
import { getIntegrationStatus } from "@/server/integrations/registry";
import { uatAccountPlan } from "./uat-accounts";

const uatRoles = [
  "super_admin",
  "admin",
  "teacher",
  "student",
  "parent",
  "accounts",
  "marketing",
  "safeguarding",
] as const;

const marketplaceRoles = new Set(["teacher", "student", "parent"]);

async function redisReachable() {
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

export async function getTestingFaculties() {
  const [
    permissionCounts,
    catalog,
    arabic,
    enabledCurrencies,
    zones,
    classroomCount,
    publicSensitive,
    redisOk,
    dedicatedAccounts,
  ] = await Promise.all([
    db
      .select({
        role: roles.key,
        n: sql<number>`count(${rolePermissions.id})::int`,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .groupBy(roles.key),
    db.select({ n: count() }).from(permissions),
    db
      .select({ direction: locales.direction, enabled: locales.isEnabled })
      .from(locales)
      .where(eq(locales.code, "ar"))
      .limit(1),
    db
      .select({ n: count() })
      .from(currencies)
      .where(eq(currencies.isEnabled, true)),
    db
      .select({
        zones: sql<number>`count(distinct ${users.timezone})::int`,
        withZone: sql<number>`count(${users.timezone})::int`,
      })
      .from(users)
      .where(isNull(users.deletedAt)),
    db.select({ n: count() }).from(classrooms),
    db
      .select({ n: count() })
      .from(files)
      .where(
        and(
          inArray(files.purpose, ["identity", "qualification", "student_document"]),
          eq(files.visibility, "public"),
        ),
      ),
    redisReachable(),
    db
      .select({
        email: users.email,
        displayName: users.displayName,
        status: users.status,
        deletedAt: users.deletedAt,
        role: roles.key,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(
        inArray(
          users.email,
          uatAccountPlan.map((item) => item.email),
        ),
      ),
  ]);

  const permissionCount = new Map(
    permissionCounts.map((row) => [row.role, Number(row.n)]),
  );
  const integrations = getIntegrationStatus();
  const connected = integrations.filter((item) => item.configured).length;

  const dedicated = new Map(dedicatedAccounts.map((row) => [row.email, row]));

  return {
    functional: { suite: false },
    integration: { connected, listed: integrations.length },
    payments: {
      gateway: Boolean(integrations.find((item) => item.key === "payments")?.configured),
      cardNumbersStored: false,
    },
    classroom: {
      rooms: Number(classroomCount[0]?.n ?? 0),
      external: Boolean(integrations.find((item) => item.key === "classroom")?.configured),
    },
    load: { runs: 0 },
    security: {
      publicSensitive: Number(publicSensitive[0]?.n ?? 0),
      https: getConfig().APP_URL.startsWith("https://"),
      scan: false,
    },
    mobile: { devicePasses: 0 },
    timezone: {
      zones: Number(zones[0]?.zones ?? 0),
      withZone: Number(zones[0]?.withZone ?? 0),
    },
    currency: { enabled: Number(enabledCurrencies[0]?.n ?? 0) },
    arabic: {
      enabled: Boolean(arabic[0]?.enabled),
      rtl: arabic[0]?.direction === "rtl",
    },
    ai: {
      external: Boolean(integrations.find((item) => item.key === "ai")?.configured),
      evaluations: 0,
    },
    permissions: {
      catalog: Number(catalog[0]?.n ?? 0),
      rows: uatRoles.map((id) => ({
        id,
        count: permissionCount.get(id) ?? 0,
        marketplace: marketplaceRoles.has(id),
        full: id === "super_admin",
      })),
    },
    performance: { redis: redisOk, runs: 0 },
    qa: {
      signedOff: false,
      storage: Boolean(integrations.find((item) => item.key === "storage")?.configured),
    },
    uat: {
      accounts: uatAccountPlan.map((plan) => {
        const row = dedicated.get(plan.email);
        const ready = Boolean(
          row && row.role === plan.id && row.status === "active" && !row.deletedAt,
        );
        return {
          id: plan.id,
          email: plan.email,
          displayName: row?.displayName ?? plan.displayName,
          ready,
          home: plan.home,
          workflow: plan.workflow,
          staff: plan.staff,
        };
      }),
    },
    browsers: {
      chrome: "checked" as const,
      safari: "not_opened" as const,
      firefox: "not_opened" as const,
      edge: "not_opened" as const,
      mobile: "not_opened" as const,
    },
  };
}
