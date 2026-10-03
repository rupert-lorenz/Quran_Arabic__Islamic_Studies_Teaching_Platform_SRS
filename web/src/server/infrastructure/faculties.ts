import { and, count, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  bookings,
  countries,
  currencies,
  files,
  groupLessons,
  liveCourses,
  prerecordedCourses,
  recordings,
  studentProfiles,
  teacherProfiles,
  teachingMaterials,
} from "@/db/schema";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { redis } from "@/redis/client";
import type { ApiActor } from "@/server/api/auth";
import { getRecordingRetentionDays } from "@/server/classroom/recording-access";
import { getConfig } from "@/server/config";
import { getIntegrationStatus } from "@/server/integrations/registry";
import { listStudentDocuments } from "./documents";

const sensitiveAction = or(
  sql`${auditLogs.action} like 'account.%'`,
  sql`${auditLogs.action} like 'privacy.%'`,
  sql`${auditLogs.action} like 'settings.%'`,
  sql`${auditLogs.action} like 'rbac.%'`,
  sql`${auditLogs.action} like 'safeguarding.%'`,
  sql`${auditLogs.action} like 'recording.%'`,
  sql`${auditLogs.action} like 'users.%'`,
  sql`${auditLogs.action} like 'document.%'`,
  sql`${auditLogs.action} like 'payments.%'`,
);

async function redisReachable() {
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

function configured(key: string) {
  return Boolean(getIntegrationStatus().find((item) => item.key === key)?.configured);
}

export async function getInfrastructureFaculties(actor: ApiActor) {
  const config = getConfig();
  const staff =
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, ["users.read", "safeguarding.incidents", "reports.academic"]);
  const retentionDays = await getRecordingRetentionDays();

  const [
    identityCount,
    qualificationCount,
    studentDocs,
    publicSensitive,
    recordingCount,
    storedRecordings,
    retainedRecordings,
    auditCount,
    auditRows,
    redisOk,
    ownDocuments,
    teacherCount,
    studentCount,
    lessonCount,
    groupLessonCount,
    countryCount,
    currencyCount,
    materialCount,
    liveCourseCount,
    recordedCourseCount,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(files)
      .where(eq(files.purpose, "identity")),
    db
      .select({ n: count() })
      .from(files)
      .where(eq(files.purpose, "qualification")),
    db
      .select({ n: count() })
      .from(files)
      .where(eq(files.purpose, "student_document")),
    db
      .select({ n: count() })
      .from(files)
      .where(
        and(
          inArray(files.purpose, ["identity", "qualification", "student_document"]),
          eq(files.visibility, "public"),
        ),
      ),
    db.select({ n: count() }).from(recordings),
    db
      .select({ n: count() })
      .from(recordings)
      .where(isNotNull(recordings.storageKey)),
    db
      .select({ n: count() })
      .from(recordings)
      .where(eq(recordings.retained, true)),
    staff
      ? db.select({ n: count() }).from(auditLogs).where(sensitiveAction)
      : Promise.resolve([{ n: 0 }]),
    staff
      ? db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(sensitiveAction)
          .orderBy(desc(auditLogs.createdAt))
          .limit(8)
      : Promise.resolve([]),
    redisReachable(),
    listStudentDocuments(actor),
    db.select({ n: count() }).from(teacherProfiles),
    db.select({ n: count() }).from(studentProfiles),
    db.select({ n: count() }).from(bookings),
    db.select({ n: count() }).from(groupLessons),
    db.select({ n: count() }).from(countries),
    db.select({ n: count() }).from(currencies),
    db.select({ n: count() }).from(teachingMaterials),
    db.select({ n: count() }).from(liveCourses),
    db.select({ n: count() }).from(prerecordedCourses),
  ]);

  const num = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
  const storage = configured("storage");
  const classroom = configured("classroom");
  const payments = configured("payments");
  const ai = configured("ai");

  return {
    documents: {
      identity: staff ? num(identityCount) : null,
      qualification: staff ? num(qualificationCount) : null,
      student: staff ? num(studentDocs) : ownDocuments.length,
      publicSensitive: num(publicSensitive),
      rows: ownDocuments,
    },
    recordings: {
      retentionDays,
      total: num(recordingCount),
      stored: num(storedRecordings),
      retained: num(retainedRecordings),
      storage,
    },
    audit: {
      visible: staff,
      total: staff ? num(auditCount) : null,
      rows: auditRows.map((row) => ({
        id: row.id,
        title: row.action,
        meta: `${row.entityType} · ${row.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
      })),
    },
    scale: {
      database: "postgres",
      cache: redisOk,
      storage,
      pool: config.DB_POOL_SIZE,
      domains: [
        { id: "teachers" as const, count: num(teacherCount) },
        { id: "students" as const, count: num(studentCount) },
        {
          id: "lessons" as const,
          booked: num(lessonCount),
          group: num(groupLessonCount),
        },
        { id: "countries" as const, count: num(countryCount) },
        { id: "currencies" as const, count: num(currencyCount) },
        { id: "recordings" as const, count: num(recordingCount) },
        { id: "materials" as const, count: num(materialCount) },
        {
          id: "courses" as const,
          live: num(liveCourseCount),
          recorded: num(recordedCourseCount),
        },
      ],
    },
    performance: {
      sessionCache: redisOk,
      rateLimit: redisOk,
      pool: config.DB_POOL_SIZE,
    },
    cdn: {
      connected: Boolean(process.env.CDN_URL),
    },
    availability: {
      replicas: 1,
      login: true,
      booking: true,
      payments: true,
      classroom: true,
    },
    integrations: {
      rows: [
        { id: "video", note: classroom ? "on" : "off" },
        { id: "payments", note: payments ? "on" : "off" },
        { id: "ai", note: ai ? "on" : "off" },
        { id: "email", note: "off" },
        { id: "sms", note: "off" },
        { id: "whatsapp", note: "off" },
        { id: "storage", note: storage ? "on" : "off" },
        { id: "analytics", note: "off" },
        { id: "crm", note: "off" },
        { id: "accounting", note: "off" },
        { id: "push", note: "off" },
      ],
    },
  };
}
