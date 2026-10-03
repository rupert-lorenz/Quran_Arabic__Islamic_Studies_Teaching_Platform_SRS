import { and, avg, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  bookingEvents,
  bookings,
  financeOperations,
  lessonHistory,
  parentChildren,
  safeguardingIncidentNotes,
  safeguardingIncidents,
  safeguardingRecordingReviews,
  secureThreads,
  teacherProfiles,
  teacherReviews,
  users,
} from "@/db/schema";
import { attendanceHref } from "@/lib/attendance";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";

type Scope = SQL | undefined;

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function total(query: Promise<{ value: number | string }[]>) {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

async function childIdsFor(parentUserId: string) {
  const rows = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, parentUserId));
  return rows.map((row) => row.id);
}

export async function getSafeguardFaculties(actor: ApiActor) {
  const staff = isStaffRole(actor.roleKey);
  const teacher = actor.roleKey === "teacher";
  const parent = actor.roleKey === "parent";
  const canModerate = hasAnyPermission(actor, ["reviews.moderate", "teachers.approve"]);
  const canIncidents = hasAnyPermission(actor, "safeguarding.incidents");
  const canRecordings = hasAnyPermission(actor, "safeguarding.recordings");
  const canSuspend = hasAnyPermission(actor, "users.suspend");
  const childIds = parent ? await childIdsFor(actor.userId) : [];
  const reviewScope: Scope = staff
    ? undefined
    : teacher
      ? eq(teacherReviews.teacherUserId, actor.userId)
      : parent
        ? eq(teacherReviews.parentUserId, actor.userId)
        : sql`false`;
  const bookingScope: Scope = staff
    ? undefined
    : teacher
      ? eq(bookings.teacherUserId, actor.userId)
      : parent
        ? or(
            eq(bookings.bookedByUserId, actor.userId),
            childIds.length ? inArray(bookings.studentUserId, childIds) : sql`false`,
          )
        : eq(bookings.studentUserId, actor.userId);
  const historyScope: Scope = staff
    ? undefined
    : teacher
      ? eq(lessonHistory.teacherUserId, actor.userId)
      : parent
        ? childIds.length
          ? inArray(lessonHistory.studentUserId, childIds)
          : sql`false`
        : eq(lessonHistory.studentUserId, actor.userId);
  const flagScope = staff
    ? eq(auditLogs.action, "contact_share.flagged")
    : and(eq(auditLogs.action, "contact_share.flagged"), eq(auditLogs.actorUserId, actor.userId));

  const where = (scope: Scope, extra: SQL | undefined) => {
    const clause = extra ?? sql`true`;
    return scope ? and(clause, scope) : clause;
  };

  const [
    pending,
    published,
    hidden,
    complaintRows,
    publishedAverage,
    reviewRows,
    completedLessons,
    noShows,
    cancelled,
    rescheduled,
    present,
    late,
    contactFlags,
    unusualPayments,
    links,
    threads,
    me,
    verification,
    suspendedUsers,
    suspendedTeachers,
  ] = await Promise.all([
    total(
      db
        .select({ value: count() })
        .from(teacherReviews)
        .where(where(reviewScope, eq(teacherReviews.status, "pending"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(teacherReviews)
        .where(where(reviewScope, eq(teacherReviews.status, "published"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(teacherReviews)
        .where(where(reviewScope, eq(teacherReviews.status, "hidden"))),
    ),
    db
      .select({ value: count() })
      .from(teacherReviews)
      .where(where(reviewScope, sql`${teacherReviews.rating} <= 2 and ${teacherReviews.status} <> 'hidden'`)),
    db
      .select({ value: avg(teacherReviews.rating) })
      .from(teacherReviews)
      .where(where(reviewScope, eq(teacherReviews.status, "published"))),
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
    total(
      db
        .select({ value: count() })
        .from(bookings)
        .where(where(bookingScope, eq(bookings.status, "completed"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(bookings)
        .where(where(bookingScope, eq(bookings.status, "no_show"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(bookings)
        .where(where(bookingScope, eq(bookings.status, "cancelled"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(bookingEvents)
        .innerJoin(bookings, eq(bookings.id, bookingEvents.bookingId))
        .where(where(bookingScope, eq(bookingEvents.kind, "rescheduled"))),
    ),
    total(
      db
        .select({ value: count() })
        .from(lessonHistory)
        .where(
          where(
            historyScope,
            and(
              eq(lessonHistory.status, "completed"),
              sql`${lessonHistory.attendedMinutes} >= ${lessonHistory.durationMinutes}`,
            ),
          ),
        ),
    ),
    total(
      db
        .select({ value: count() })
        .from(lessonHistory)
        .where(
          where(
            historyScope,
            and(
              eq(lessonHistory.status, "completed"),
              sql`${lessonHistory.attendedMinutes} > 0`,
              sql`${lessonHistory.attendedMinutes} < ${lessonHistory.durationMinutes}`,
            ),
          ),
        ),
    ),
    total(db.select({ value: count() }).from(auditLogs).where(flagScope)),
    total(
      db
        .select({ value: count() })
        .from(financeOperations)
        .where(paymentWhere(actor, staff, teacher)),
    ),
    total(
      staff
        ? db.select({ value: count() }).from(parentChildren)
        : parent
          ? db
              .select({ value: count() })
              .from(parentChildren)
              .where(eq(parentChildren.parentUserId, actor.userId))
          : db
              .select({
                value: sql<number>`count(distinct ${parentChildren.childUserId})`,
              })
              .from(parentChildren)
              .innerJoin(bookings, eq(bookings.studentUserId, parentChildren.childUserId))
              .where(eq(bookings.teacherUserId, actor.userId)),
    ),
    (staff
      ? db.select({ channel: secureThreads.channel, value: count() }).from(secureThreads)
      : db
          .select({ channel: secureThreads.channel, value: count() })
          .from(secureThreads)
          .where(
            or(
              eq(secureThreads.participantLow, actor.userId),
              eq(secureThreads.participantHigh, actor.userId),
            ),
          )
    ).groupBy(secureThreads.channel),
    db
      .select({ status: users.status, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1),
    teacher
      ? db
          .select({ status: teacherProfiles.verificationStatus })
          .from(teacherProfiles)
          .where(eq(teacherProfiles.userId, actor.userId))
          .limit(1)
      : Promise.resolve([]),
    canSuspend || canIncidents
      ? total(
          db.select({ value: count() }).from(users).where(eq(users.status, "suspended")),
        )
      : Promise.resolve(0),
    canSuspend || canIncidents
      ? total(
          db
            .select({ value: count() })
            .from(teacherProfiles)
            .where(eq(teacherProfiles.verificationStatus, "suspended")),
        )
      : Promise.resolve(0),
  ]);

  const [risk, incidents, recordings, flagRows, paymentRows, suspendedRows] = await Promise.all([
    riskCounts(actor, staff, teacher, noShows, contactFlags),
    incidentCounts(canIncidents),
    recordingCounts(canRecordings),
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
        displayName: users.displayName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(flagScope)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
    db
      .select({
        id: financeOperations.id,
        kind: financeOperations.kind,
        status: financeOperations.status,
        createdAt: financeOperations.createdAt,
      })
      .from(financeOperations)
      .where(paymentWhere(actor, staff, teacher))
      .orderBy(desc(financeOperations.createdAt))
      .limit(8),
    canSuspend || canIncidents
      ? db
          .select({
            id: users.id,
            displayName: users.displayName,
            status: users.status,
          })
          .from(users)
          .where(eq(users.status, "suspended"))
          .orderBy(users.displayName)
          .limit(8)
      : Promise.resolve([]),
  ]);

  const average = publishedAverage[0]?.value ? Number(publishedAverage[0].value) : null;
  const complaints = Number(complaintRows[0]?.value ?? 0);
  const kept = completedLessons + cancelled;
  const channelCount = (channel: string) =>
    Number(threads.find((row) => row.channel === channel)?.value ?? 0);
  const reviewList = reviewRows.map((row) => ({
    id: row.id,
    title: `${row.rating} stars`,
    meta: `${row.status} · ${day(row.createdAt)}`,
  }));
  const alerts = flagRows.map((row) => ({
    id: row.id,
    title: row.displayName || "Account",
    meta: `${typeof row.metadata?.channel === "string" ? row.metadata.channel : "messages"} · ${day(row.createdAt)}`,
  }));

  return {
    role: staff ? "staff" : teacher ? "teacher" : parent ? "parent" : "student",
    canModerate,
    canIncidents,
    canRecordings,
    canSuspend,
    links: {
      reviews: staff ? "/staff/reviews" : null,
      attendance: attendanceHref(actor.roleKey, staff),
      safeguarding: canIncidents || canRecordings ? "/staff/safeguarding" : null,
      users: canSuspend ? "/staff/users" : staff ? "/staff/teachers" : null,
      messages: "/messages",
      accounts: staff ? "/staff/accounts" : teacher ? "/teach/earnings" : parent ? "/family/wallet" : null,
    },
    ratings: {
      pending,
      published,
      hidden,
      average,
      rows: reviewList,
    },
    moderation: {
      pending: canModerate ? pending : null,
      published: canModerate ? published : null,
      hidden: canModerate ? hidden : null,
      rows: canModerate ? reviewList.filter((row) => row.meta.startsWith("pending")) : [],
    },
    performance: {
      completed: completedLessons,
      noShows,
      cancelled,
      average,
    },
    attendance: { present, late, cancelled, rescheduled },
    teaching: {
      retained: kept ? Math.round((completedLessons / kept) * 100) : null,
      complaints,
      published,
      average,
    },
    risk,
    alerts: { total: contactFlags, rows: alerts },
    payments: {
      total: unusualPayments,
      rows: paymentRows.map((row) => ({
        id: row.id,
        title: row.kind,
        meta: `${row.status} · ${day(row.createdAt)}`,
      })),
    },
    children: {
      links,
      incidents: incidents.linkedChildren,
    },
    secure: {
      teacherStudent: channelCount("teacher_student"),
      teacherParent: channelCount("teacher_parent"),
      teacherAdmin: channelCount("teacher_admin"),
      familyAdmin: channelCount("family_admin"),
    },
    incidents,
    recordings,
    suspension: {
      users: canSuspend || canIncidents ? suspendedUsers : null,
      teachers: canSuspend || canIncidents ? suspendedTeachers : null,
      ownStatus: me[0]?.status ?? "active",
      ownVerification: verification[0]?.status ?? null,
      rows:
        canSuspend || canIncidents
          ? suspendedRows.map((row) => ({
              id: row.id,
              title: row.displayName,
              meta: row.status,
            }))
          : [],
    },
  };
}

function paymentWhere(actor: ApiActor, staff: boolean, teacher: boolean) {
  const unusual = or(
    eq(financeOperations.status, "on_hold"),
    eq(financeOperations.status, "rejected"),
    sql`${financeOperations.notes} ilike '%partial%'`,
  );
  const kinds = teacher || staff
    ? or(
        eq(financeOperations.kind, "refund"),
        eq(financeOperations.kind, "payment"),
        eq(financeOperations.kind, "payout"),
      )
    : or(eq(financeOperations.kind, "refund"), eq(financeOperations.kind, "payment"));
  const scope = staff ? undefined : eq(financeOperations.counterpartyUserId, actor.userId);
  return scope ? and(kinds, unusual, scope) : and(kinds, unusual);
}

async function riskCounts(
  actor: ApiActor,
  staff: boolean,
  teacher: boolean,
  ownNoShows: number,
  ownFlags: number,
) {
  if (!staff && !teacher) {
    return {
      lowRating: null as number | null,
      noShows: null as number | null,
      flags: ownFlags,
      holds: null as number | null,
    };
  }
  if (!staff) {
    const [averageRow, reviewCount, holds] = await Promise.all([
      db
        .select({ value: avg(teacherReviews.rating) })
        .from(teacherReviews)
        .where(
          and(
            eq(teacherReviews.teacherUserId, actor.userId),
            eq(teacherReviews.status, "published"),
          ),
        ),
      total(
        db
          .select({ value: count() })
          .from(teacherReviews)
          .where(
            and(
              eq(teacherReviews.teacherUserId, actor.userId),
              eq(teacherReviews.status, "published"),
            ),
          ),
      ),
      total(
        db
          .select({ value: count() })
          .from(financeOperations)
          .where(paymentWhere(actor, false, true)),
      ),
    ]);
    const average = averageRow[0]?.value ? Number(averageRow[0].value) : null;
    return {
      lowRating: average !== null && reviewCount >= 2 && average < 3 ? 1 : 0,
      noShows: ownNoShows >= 3 ? 1 : 0,
      flags: ownFlags > 0 ? 1 : 0,
      holds,
    };
  }
  const [ratings, misses] = await Promise.all([
    db
      .select({
        teacherUserId: teacherReviews.teacherUserId,
        average: avg(teacherReviews.rating),
        total: count(),
      })
      .from(teacherReviews)
      .where(eq(teacherReviews.status, "published"))
      .groupBy(teacherReviews.teacherUserId),
    db
      .select({ teacherUserId: bookings.teacherUserId, total: count() })
      .from(bookings)
      .where(eq(bookings.status, "no_show"))
      .groupBy(bookings.teacherUserId),
  ]);
  return {
    lowRating: ratings.filter(
      (row) => Number(row.total) >= 2 && Number(row.average) < 3,
    ).length,
    noShows: misses.filter((row) => Number(row.total) >= 3).length,
    flags: ownFlags,
    holds: await total(
      db
        .select({ value: count() })
        .from(financeOperations)
        .where(paymentWhere(actor, true, true)),
    ),
  };
}

async function incidentCounts(allowed: boolean) {
  if (!allowed) {
    return {
      open: null as number | null,
      investigating: null as number | null,
      escalated: null as number | null,
      closed: null as number | null,
      notes: null as number | null,
      linkedChildren: null as number | null,
      rows: [] as { id: string; title: string; meta: string }[],
    };
  }
  const [statuses, notes, linkedChildren, rows] = await Promise.all([
    db.select({ status: safeguardingIncidents.status }).from(safeguardingIncidents),
    total(db.select({ value: count() }).from(safeguardingIncidentNotes)),
    total(
      db
        .select({ value: sql<number>`count(distinct ${safeguardingIncidents.id})` })
        .from(safeguardingIncidents)
        .innerJoin(
          parentChildren,
          eq(parentChildren.childUserId, safeguardingIncidents.involvedUserId),
        ),
    ),
    db
      .select({
        id: safeguardingIncidents.id,
        title: safeguardingIncidents.title,
        status: safeguardingIncidents.status,
        severity: safeguardingIncidents.severity,
        updatedAt: safeguardingIncidents.updatedAt,
      })
      .from(safeguardingIncidents)
      .orderBy(desc(safeguardingIncidents.updatedAt))
      .limit(8),
  ]);
  const tally = (status: string) => statuses.filter((row) => row.status === status).length;
  return {
    open: tally("open"),
    investigating: tally("investigating"),
    escalated: tally("escalated"),
    closed: tally("resolved") + tally("closed"),
    notes,
    linkedChildren,
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      meta: `${row.status} · ${row.severity} · ${day(row.updatedAt)}`,
    })),
  };
}

async function recordingCounts(allowed: boolean) {
  if (!allowed) {
    return {
      flagged: null as number | null,
      underReview: null as number | null,
      cleared: null as number | null,
      retained: null as number | null,
      rows: [] as { id: string; title: string; meta: string }[],
    };
  }
  const countStatus = (status: "flagged" | "under_review" | "cleared" | "retained") =>
    total(
      db
        .select({ value: count() })
        .from(safeguardingRecordingReviews)
        .where(eq(safeguardingRecordingReviews.status, status)),
    );
  const [flagged, underReview, cleared, retained, rows] = await Promise.all([
    countStatus("flagged"),
    countStatus("under_review"),
    countStatus("cleared"),
    countStatus("retained"),
    db
      .select({
        id: safeguardingRecordingReviews.id,
        reference: safeguardingRecordingReviews.reference,
        status: safeguardingRecordingReviews.status,
        updatedAt: safeguardingRecordingReviews.updatedAt,
      })
      .from(safeguardingRecordingReviews)
      .orderBy(desc(safeguardingRecordingReviews.updatedAt))
      .limit(8),
  ]);
  return {
    flagged,
    underReview,
    cleared,
    retained,
    rows: rows.map((row) => ({
      id: row.id,
      title: row.reference,
      meta: `${row.status} · ${day(row.updatedAt)}`,
    })),
  };
}
