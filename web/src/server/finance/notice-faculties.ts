import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  safeguardingIncidents,
  safeguardingRecordingReviews,
  teacherReviews,
  userNotifications,
  users,
} from "@/db/schema";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getIntegrationStatus } from "@/server/integrations/registry";
import { ensureLessonReminders } from "@/server/communications/reminders";
import {
  getEmailTemplates,
  getReminderSettings,
} from "@/server/communications/settings";

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

function channelOf(metadata: Record<string, unknown> | null) {
  const channel = metadata?.channel;
  return typeof channel === "string" ? channel : "messages";
}

export async function getNoticeFaculties(actor: ApiActor) {
  const staff = isStaffRole(actor.roleKey);
  const remindersRun = await ensureLessonReminders(actor);
  const [reminders, templates, flags, email, inbox, quality] = await Promise.all([
    reminderFaculty(actor, staff, remindersRun.due),
    templateFaculty(actor),
    flagFaculty(actor, staff),
    emailFaculty(),
    inboxFaculty(actor, staff),
    qualityFaculty(actor),
  ]);
  return {
    contactGuard: {
      channels: 4,
      flags: flags.total,
      recent: flags.recent,
    },
    contactFlags: flags,
    email,
    inbox,
    push: { connected: false, devices: 0, sent: 0 },
    sms: { connected: false, sent: 0, queued: 0 },
    whatsapp: { connected: false, permitted: false, sent: 0 },
    reminders,
    templates,
    quality,
  };
}

export async function getQualityFaculty(actor: ApiActor) {
  return qualityFaculty(actor);
}

async function flagFaculty(actor: ApiActor, staff: boolean) {
  const own = eq(auditLogs.actorUserId, actor.userId);
  const flagged = eq(auditLogs.action, "contact_share.flagged");
  const scope = staff ? flagged : and(flagged, own);
  const channelCount = async (channel: string) => {
    const [row] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(and(scope, sql`${auditLogs.metadata}->>'channel' = ${channel}`));
    return Number(row?.value ?? 0);
  };
  const [totalRow, classroom, whiteboard, files, messages, recent] = await Promise.all([
    db.select({ value: count() }).from(auditLogs).where(scope),
    channelCount("classroom"),
    channelCount("whiteboard"),
    channelCount("files"),
    channelCount("messages"),
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
        displayName: users.displayName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(scope)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);
  return {
    total: Number(totalRow[0]?.value ?? 0),
    classroom,
    whiteboard,
    files,
    messages,
    recent: recent.map((row) => ({
      id: row.id,
      title: row.displayName || "Account",
      meta: `${channelOf(row.metadata)} · ${day(row.createdAt)}`,
    })),
  };
}

async function emailFaculty() {
  const configured = Boolean(
    getIntegrationStatus().find((item) => item.key === "email")?.configured,
  );
  const composedWhere = eq(auditLogs.action, "email.composed");
  const [composedRow, recent] = await Promise.all([
    db.select({ value: count() }).from(auditLogs).where(composedWhere),
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(composedWhere)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);
  return {
    configured,
    composed: Number(composedRow[0]?.value ?? 0),
    delivered: 0,
    recent: recent.map((row) => ({
      id: row.id,
      title:
        typeof row.metadata?.templateKey === "string"
          ? row.metadata.templateKey
          : "custom",
      meta: `composed · ${day(row.createdAt)}`,
    })),
  };
}

async function inboxFaculty(actor: ApiActor, staff: boolean) {
  const own = eq(userNotifications.userId, actor.userId);
  const [totalRow, unreadRow, recent] = await Promise.all([
    staff
      ? db.select({ value: count() }).from(userNotifications)
      : db.select({ value: count() }).from(userNotifications).where(own),
    staff
      ? db
          .select({ value: count() })
          .from(userNotifications)
          .where(isNull(userNotifications.readAt))
      : db
          .select({ value: count() })
          .from(userNotifications)
          .where(and(own, isNull(userNotifications.readAt))),
    staff
      ? Promise.resolve([])
      : db
          .select({
            id: userNotifications.id,
            title: userNotifications.title,
            kind: userNotifications.kind,
            createdAt: userNotifications.createdAt,
            readAt: userNotifications.readAt,
          })
          .from(userNotifications)
          .where(own)
          .orderBy(desc(userNotifications.createdAt))
          .limit(8),
  ]);
  const total = Number(totalRow[0]?.value ?? 0);
  const unread = Number(unreadRow[0]?.value ?? 0);
  return {
    total,
    unread,
    read: Math.max(0, total - unread),
    recent: recent.map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.readAt ? "read" : "unread"} · ${row.kind} · ${day(row.createdAt)}`,
    })),
  };
}

async function reminderFaculty(actor: ApiActor, staff: boolean, due: number) {
  const settings = await getReminderSettings();
  const own = and(
    eq(userNotifications.userId, actor.userId),
    eq(userNotifications.kind, "lesson_reminder"),
  );
  const [sentRow, recent] = await Promise.all([
    staff
      ? db
          .select({ value: count() })
          .from(userNotifications)
          .where(eq(userNotifications.kind, "lesson_reminder"))
      : db.select({ value: count() }).from(userNotifications).where(own),
    staff
      ? Promise.resolve([])
      : db
          .select({
            id: userNotifications.id,
            title: userNotifications.title,
            body: userNotifications.body,
            createdAt: userNotifications.createdAt,
          })
          .from(userNotifications)
          .where(own)
          .orderBy(desc(userNotifications.createdAt))
          .limit(8),
  ]);
  return {
    enabled: settings.enabled,
    leadHours: settings.leadHours,
    leadLabel: settings.leadHours.map((hours) => `${hours}h`).join(", "),
    due,
    sent: Number(sentRow[0]?.value ?? 0),
    canEdit: hasAnyPermission(actor, "settings.write"),
    recent: recent.map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.body} · ${day(row.createdAt)}`,
    })),
  };
}

async function templateFaculty(actor: ApiActor) {
  const items = await getEmailTemplates();
  return {
    items,
    canEdit: hasAnyPermission(actor, "settings.write"),
    recent: items.map((item) => ({
      id: item.key,
      title: item.subject,
      meta: item.body,
    })),
  };
}

async function qualityFaculty(actor: ApiActor) {
  const staff = isStaffRole(actor.roleKey);
  const reviewScope = staff
    ? undefined
    : actor.roleKey === "teacher"
      ? eq(teacherReviews.teacherUserId, actor.userId)
      : actor.roleKey === "parent"
        ? eq(teacherReviews.parentUserId, actor.userId)
        : sql`false`;
  const countStatus = async (status: "pending" | "published" | "hidden") => {
    const where = reviewScope
      ? and(eq(teacherReviews.status, status), reviewScope)
      : eq(teacherReviews.status, status);
    const [row] = await db
      .select({ value: count() })
      .from(teacherReviews)
      .where(where);
    return Number(row?.value ?? 0);
  };
  const canIncidents = hasAnyPermission(actor, "safeguarding.incidents");
  const canRecordings = hasAnyPermission(actor, "safeguarding.recordings");
  const [pending, published, hidden, reviewRows, openRow, recordingRow, incidentRows, recordingRows] =
    await Promise.all([
      countStatus("pending"),
      countStatus("published"),
      countStatus("hidden"),
      (reviewScope
        ? db
            .select({
              id: teacherReviews.id,
              rating: teacherReviews.rating,
              status: teacherReviews.status,
              createdAt: teacherReviews.createdAt,
            })
            .from(teacherReviews)
            .where(reviewScope)
        : db
            .select({
              id: teacherReviews.id,
              rating: teacherReviews.rating,
              status: teacherReviews.status,
              createdAt: teacherReviews.createdAt,
            })
            .from(teacherReviews)
      )
        .orderBy(desc(teacherReviews.createdAt))
        .limit(8),
      canIncidents
        ? db
            .select({ value: count() })
            .from(safeguardingIncidents)
            .where(
              sql`${safeguardingIncidents.status} in ('open', 'investigating', 'escalated')`,
            )
        : Promise.resolve([{ value: 0 }]),
      canRecordings
        ? db
            .select({ value: count() })
            .from(safeguardingRecordingReviews)
            .where(eq(safeguardingRecordingReviews.status, "flagged"))
        : Promise.resolve([{ value: 0 }]),
      canIncidents
        ? db
            .select({
              id: safeguardingIncidents.id,
              title: safeguardingIncidents.title,
              status: safeguardingIncidents.status,
              severity: safeguardingIncidents.severity,
              updatedAt: safeguardingIncidents.updatedAt,
            })
            .from(safeguardingIncidents)
            .orderBy(desc(safeguardingIncidents.updatedAt))
            .limit(5)
        : Promise.resolve([]),
      canRecordings
        ? db
            .select({
              id: safeguardingRecordingReviews.id,
              reference: safeguardingRecordingReviews.reference,
              status: safeguardingRecordingReviews.status,
              updatedAt: safeguardingRecordingReviews.updatedAt,
            })
            .from(safeguardingRecordingReviews)
            .orderBy(desc(safeguardingRecordingReviews.updatedAt))
            .limit(5)
        : Promise.resolve([]),
    ]);
  return {
    pending,
    published,
    hidden,
    reports: canIncidents ? Number(openRow[0]?.value ?? 0) : null,
    recordings: canRecordings ? Number(recordingRow[0]?.value ?? 0) : null,
    recent: [
      ...reviewRows.map((row) => ({
        id: row.id,
        title: `${row.rating} stars`,
        meta: `${row.status} · ${day(row.createdAt)}`,
      })),
      ...incidentRows.map((row) => ({
        id: row.id,
        title: row.title,
        meta: `${row.status} · ${row.severity} · ${day(row.updatedAt)}`,
      })),
      ...recordingRows.map((row) => ({
        id: row.id,
        title: row.reference,
        meta: `${row.status} · ${day(row.updatedAt)}`,
      })),
    ].slice(0, 8),
  };
}
