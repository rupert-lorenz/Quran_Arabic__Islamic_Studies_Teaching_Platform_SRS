import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classrooms,
  lessonHistory,
  parentChildren,
  presenceEvents,
  roles,
  users,
} from "@/db/schema";
import {
  familyChildPresenceHref,
  isPresenceKind,
  presenceHref,
  summarizePresence,
  type PresenceKind,
} from "@/lib/presence";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";

export type PresenceEventView = {
  id: string;
  kind: PresenceKind;
  title: string;
  at: string;
};

export type PresenceSummary = {
  logins: number;
  logouts: number;
  enters: number;
  exits: number;
};

export type PresenceLearner = {
  studentUserId: string;
  name: string;
  href: string;
  enters: number;
  exits: number;
  logins: number;
};

export type PresenceProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  events: PresenceEventView[];
  summary: PresenceSummary;
};

export type PresenceDesk = {
  href: string;
  learners: PresenceLearner[];
  profile: PresenceProfile | null;
  own: PresenceProfile | null;
};

const EVENT_LIMIT = 80;

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
    "safeguarding.recordings",
  ]);
}

function presencePath(actor: ApiActor, studentUserId?: string) {
  return presenceHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

export async function recordPresence(input: {
  userId: string;
  kind: PresenceKind;
  classroomId?: string | null;
  title?: string | null;
  ipAddress?: string | null;
}) {
  await db.insert(presenceEvents).values({
    userId: input.userId,
    kind: input.kind,
    classroomId: input.classroomId ?? null,
    title: input.title?.slice(0, 180) || null,
    ipAddress: input.ipAddress ?? null,
  });
}

export async function safeRecordPresence(input: {
  userId: string;
  kind: PresenceKind;
  classroomId?: string | null;
  title?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await recordPresence(input);
  } catch {
    // Tracking must never fail a login, logout, join, or leave.
  }
}

async function namesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? "Student"]));
}

async function listTeacherLearnerIds(teacherUserId: string) {
  const [historyRows, classroomRows] = await Promise.all([
    db
      .selectDistinct({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .where(eq(lessonHistory.teacherUserId, teacherUserId)),
    db
      .selectDistinct({ id: presenceEvents.userId })
      .from(presenceEvents)
      .innerJoin(classrooms, eq(classrooms.id, presenceEvents.classroomId))
      .innerJoin(users, eq(users.id, presenceEvents.userId))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(classrooms.teacherUserId, teacherUserId),
          eq(roles.key, "student"),
        ),
      ),
  ]);
  return [
    ...new Set([...historyRows, ...classroomRows].map((row) => row.id)),
  ].filter((id) => id !== teacherUserId);
}

async function listLearnerIds(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    return children.map((child) => child.id);
  }
  if (actor.roleKey === "teacher" && !isStaffAcademic(actor)) {
    return (await listTeacherLearnerIds(actor.userId)).slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const rows = await db
      .select({ id: presenceEvents.userId })
      .from(presenceEvents)
      .innerJoin(users, eq(users.id, presenceEvents.userId))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.key, "student"))
      .groupBy(presenceEvents.userId)
      .orderBy(desc(sql`max(${presenceEvents.createdAt})`))
      .limit(60);
    if (rows.length) return rows.map((row) => row.id);
    const recent = await db
      .select({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .groupBy(lessonHistory.studentUserId)
      .orderBy(desc(sql`max(${lessonHistory.startedAt})`))
      .limit(40);
    return [...new Set(recent.map((row) => row.id))];
  }
  return [];
}

async function assertCanViewStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) return;
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (isStaffAcademic(actor)) return;
  if (actor.roleKey === "teacher") {
    const known = await listTeacherLearnerIds(actor.userId);
    if (known.includes(studentUserId)) return;
    throw new ApiError(403, "FORBIDDEN", "You cannot view this activity");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this activity");
}

async function loadEvents(userId: string): Promise<PresenceEventView[]> {
  const rows = await db
    .select()
    .from(presenceEvents)
    .where(eq(presenceEvents.userId, userId))
    .orderBy(desc(presenceEvents.createdAt))
    .limit(EVENT_LIMIT);
  return rows.map((row) => ({
    id: row.id,
    kind: isPresenceKind(row.kind) ? row.kind : "login",
    title: row.title ?? "",
    at: row.createdAt.toISOString(),
  }));
}

function profileFromEvents(
  actor: ApiActor,
  userId: string,
  name: string,
  events: PresenceEventView[],
): PresenceProfile {
  return {
    studentUserId: userId,
    studentName: name,
    href:
      actor.roleKey === "parent"
        ? familyChildPresenceHref(userId)
        : presencePath(actor, userId),
    events,
    summary: summarizePresence(events.map((event) => event.kind)),
  };
}

export async function getPresenceDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<PresenceDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  if (requested && !ids.includes(requested)) ids.unshift(requested);
  const selected =
    requested && ids.includes(requested)
      ? requested
      : actor.roleKey === "student"
        ? actor.userId
        : ids.length === 1
          ? ids[0]
          : requested && isStaffAcademic(actor)
            ? requested
            : undefined;
  if (selected && !ids.includes(selected)) ids.unshift(selected);
  const uniqueIds = [...new Set(ids)];
  const ownId = actor.roleKey === "student" ? undefined : actor.userId;
  const nameIds = [...new Set([...uniqueIds, ownId].filter(Boolean))] as string[];
  const names = await namesFor(nameIds);
  const eventMap = new Map<string, PresenceEventView[]>();
  await Promise.all(
    nameIds.map(async (id) => {
      eventMap.set(id, await loadEvents(id));
    }),
  );
  const learners = uniqueIds
    .map((id) => {
      const events = eventMap.get(id) ?? [];
      const summary = summarizePresence(events.map((event) => event.kind));
      return {
        studentUserId: id,
        name: names.get(id) ?? "Student",
        href:
          actor.roleKey === "parent"
            ? familyChildPresenceHref(id)
            : presencePath(actor, id),
        enters: summary.enters,
        exits: summary.exits,
        logins: summary.logins,
      };
    })
    .sort(
      (left, right) =>
        right.enters - left.enters ||
        right.logins - left.logins ||
        left.name.localeCompare(right.name),
    );
  const profile = selected
    ? profileFromEvents(
        actor,
        selected,
        names.get(selected) ?? "Student",
        eventMap.get(selected) ?? [],
      )
    : null;
  const own =
    ownId && ownId !== selected
      ? profileFromEvents(
          actor,
          ownId,
          names.get(ownId) ?? "You",
          eventMap.get(ownId) ?? [],
        )
      : null;
  return {
    href: presencePath(actor, selected),
    learners,
    profile,
    own,
  };
}
