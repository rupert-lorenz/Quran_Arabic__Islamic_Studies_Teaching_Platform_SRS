import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  files,
  parentChildren,
  permissions,
  privacyConsents,
  recordings,
  roles,
  sessions,
  studentProfiles,
  userTotp,
  users,
} from "@/db/schema";
import { staffRoles } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getConfig } from "@/server/config";
import { getPaymentsAdapter } from "@/server/finance/adapter";
import { getIntegrationStatus } from "@/server/integrations/registry";
import { redis } from "@/redis/client";
import { isUnder18, linkedChildCount, marketingAllowed } from "./privacy";

function when(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

async function redisReachable() {
  try {
    const reply = await redis.ping();
    return reply === "PONG";
  } catch {
    return false;
  }
}

export async function getSecurityFaculties(actor: ApiActor) {
  const config = getConfig();
  const https = config.APP_URL.startsWith("https://");
  const payments = getPaymentsAdapter();
  const storage = getIntegrationStatus().find((item) => item.key === "storage");
  const staff = staffRoles.includes(actor.roleKey as (typeof staffRoles)[number]);

  const [
    consentRows,
    ownSessions,
    permissionRows,
    staffRows,
    totpRows,
    ownFiles,
    privateFiles,
    ownDocs,
    recordingDays,
    studentBirth,
    ownBirth,
    childLinks,
    redisOk,
    marketingAllowedFlag,
  ] = await Promise.all([
    db
      .select()
      .from(privacyConsents)
      .where(eq(privacyConsents.userId, actor.userId)),
    db
      .select({ n: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, actor.userId), sql`${sessions.expiresAt} > now()`)),
    db.select({ n: count() }).from(permissions),
    staff
      ? db
          .select({ n: count() })
          .from(users)
          .innerJoin(roles, eq(roles.id, users.roleId))
          .where(and(inArray(roles.key, [...staffRoles]), isNull(users.deletedAt)))
      : Promise.resolve([{ n: 0 }]),
    staff
      ? db
          .select({ n: count() })
          .from(userTotp)
          .innerJoin(users, eq(users.id, userTotp.userId))
          .innerJoin(roles, eq(roles.id, users.roleId))
          .where(
            and(
              inArray(roles.key, [...staffRoles]),
              isNull(users.deletedAt),
              isNotNull(userTotp.enabledAt),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(files)
      .where(eq(files.ownerUserId, actor.userId)),
    staff
      ? db
          .select({ n: count() })
          .from(files)
          .where(inArray(files.purpose, ["identity", "qualification"]))
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(files)
      .where(
        and(
          eq(files.ownerUserId, actor.userId),
          inArray(files.purpose, ["identity", "qualification"]),
        ),
      ),
    db.select({ n: count() }).from(recordings),
    staff
      ? db
          .select({
            recorded: count(),
            under18: sql<number>`count(*) filter (where ${studentProfiles.dateOfBirth} > now() - interval '18 years')`,
          })
          .from(studentProfiles)
      : Promise.resolve([{ recorded: 0, under18: 0 }]),
    actor.roleKey === "student"
      ? db
          .select({
            dateOfBirth: studentProfiles.dateOfBirth,
            parentManaged: studentProfiles.parentManaged,
          })
          .from(studentProfiles)
          .where(eq(studentProfiles.userId, actor.userId))
          .limit(1)
      : Promise.resolve([]),
    actor.roleKey === "parent"
      ? linkedChildCount(actor.userId)
      : Promise.resolve(0),
    redisReachable(),
    marketingAllowed(actor),
  ]);

  const num = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
  const privacy = consentRows.find((row) => row.kind === "privacy");
  const marketing = consentRows.find((row) => row.kind === "marketing");
  const birth = ownBirth[0];
  const under18 = birth?.dateOfBirth ? isUnder18(birth.dateOfBirth) : null;
  const childCounts = studentBirth[0] ?? { recorded: 0, under18: 0 };

  const [parentManagedChildren] =
    actor.roleKey === "parent"
      ? await db
          .select({ n: count() })
          .from(parentChildren)
          .innerJoin(
            studentProfiles,
            eq(studentProfiles.userId, parentChildren.childUserId),
          )
          .where(
            and(
              eq(parentChildren.parentUserId, actor.userId),
              eq(studentProfiles.parentManaged, true),
            ),
          )
      : [{ n: 0 }];

  return {
    ssl: {
      https,
      cookieSecure: config.cookieSecure,
      environment: config.APP_ENV,
    },
    authentication: {
      method: "email-password",
      lockout: true,
      csrf: true,
    },
    password: {
      algorithm: "scrypt",
      parameters: "N=16384, r=8, p=1",
      shown: false,
    },
    twoFactor: {
      requiredFor: "staff",
      staff: staff ? num(staffRows) : null,
      enrolled: staff ? num(totpRows) : null,
      yoursRequired: staff,
    },
    api: {
      version: "v1",
      csrf: true,
      bodyLimitKb: 32,
    },
    rateLimit: {
      connected: redisOk,
      windowSeconds: config.rateLimitWindowSeconds,
      publicMax: config.rateLimitPublicMax,
      sensitiveMax: config.rateLimitSensitiveMax,
    },
    session: {
      ttlDays: Math.round(config.sessionTtlSeconds / 86400),
      yours: num(ownSessions),
      httpOnly: true,
      sameSite: "Lax",
      secure: config.cookieSecure,
    },
    files: {
      storageConnected: Boolean(storage?.configured),
      yours: num(ownFiles),
      privateDocuments: staff ? num(privateFiles) : null,
    },
    payments: {
      gateway: payments.configured ? payments.id : "not_connected",
      configured: payments.configured,
      cardNumbersStored: false,
    },
    roles: {
      permissions: num(permissionRows),
      yours: actor.permissions.length,
      custom: actor.roleKey === "super_admin" ? "all" : "role",
    },
    privacy: {
      granted: privacy?.granted ?? false,
      recordedAt: privacy?.recordedAt ?? null,
      rows: privacy
        ? [{ id: "privacy", title: privacy.granted ? "Accepted" : "Withdrawn", meta: when(privacy.recordedAt) }]
        : [],
    },
    marketing: {
      granted: actor.roleKey === "student" ? false : marketing?.granted ?? false,
      allowed: marketingAllowedFlag,
      recordedAt: marketing?.recordedAt ?? null,
      rows:
        marketing && actor.roleKey !== "student"
          ? [
              {
                id: "marketing",
                title: marketing.granted ? "Opted in" : "Opted out",
                meta: when(marketing.recordedAt),
              },
            ]
          : [],
    },
    retention: {
      sessionsExpire: true,
      softDelete: true,
      financeKept: true,
      recordings: num(recordingDays),
    },
    children: {
      student: actor.roleKey === "student",
      parentManaged: Boolean(birth?.parentManaged),
      dateOfBirthOnFile: Boolean(birth?.dateOfBirth),
      under18,
      linkedChildren: actor.roleKey === "parent" ? childLinks : null,
      parentManagedChildren: actor.roleKey === "parent" ? num([parentManagedChildren]) : null,
      recordedBirths: staff ? Number(childCounts.recorded ?? 0) : null,
      under18Students: staff ? Number(childCounts.under18 ?? 0) : null,
    },
    documents: {
      yours: num(ownDocs),
      platform: staff ? num(privateFiles) : null,
    },
  };
}
