import { and, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  groupLessonEnrollments,
  groupLessons,
  parentChildren,
  userNotifications,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import {
  fillEmailTemplate,
  getEmailTemplates,
  getReminderSettings,
} from "@/server/communications/settings";

type DueLesson = {
  key: string;
  title: string;
  startsAt: Date;
  href: string;
};

function hrefFor(roleKey: string) {
  if (roleKey === "teacher") return "/teach/bookings";
  if (roleKey === "parent") return "/family/bookings";
  return "/learn/bookings";
}

function whenLabel(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export async function ensureLessonReminders(actor: ApiActor) {
  const settings = await getReminderSettings();
  if (!settings.enabled) return { due: 0, created: 0 };
  if (actor.roleKey !== "teacher" && actor.roleKey !== "parent" && actor.roleKey !== "student") {
    return { due: 0, created: 0 };
  }
  const maxLead = Math.max(...settings.leadHours);
  const now = new Date();
  const horizon = new Date(now.getTime() + maxLead * 60 * 60 * 1000);
  const href = hrefFor(actor.roleKey);
  const lessons = await dueLessons(actor, now, horizon, href);
  const due = lessons.filter((lesson) =>
    settings.leadHours.some(
      (hours) => lesson.startsAt.getTime() <= now.getTime() + hours * 60 * 60 * 1000,
    ),
  );
  if (!due.length) return { due: 0, created: 0 };

  const existing = await db
    .select({ metadata: userNotifications.metadata })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.userId, actor.userId),
        eq(userNotifications.kind, "lesson_reminder"),
      ),
    )
    .orderBy(desc(userNotifications.createdAt))
    .limit(80);
  const seen = new Set(
    existing
      .map((row) => row.metadata?.reminderKey)
      .filter((value): value is string => typeof value === "string"),
  );
  const template = (await getEmailTemplates()).find((item) => item.key === "lesson_reminder");
  const name = actor.displayName?.split(" ")[0] || "there";
  const rows: (typeof userNotifications.$inferInsert)[] = [];
  for (const lesson of due) {
    for (const hours of settings.leadHours) {
      if (lesson.startsAt.getTime() > now.getTime() + hours * 60 * 60 * 1000) continue;
      const reminderKey = `${lesson.key}:${hours}`;
      if (seen.has(reminderKey)) continue;
      seen.add(reminderKey);
      const when = whenLabel(lesson.startsAt);
      rows.push({
        userId: actor.userId,
        kind: "lesson_reminder",
        title: (template?.subject || "Lesson reminder").slice(0, 180),
        body: fillEmailTemplate(
          template?.body || "Hello {{name}}, your lesson is coming up at {{when}}.",
          { name, when, link: lesson.href },
        ).slice(0, 500),
        href: lesson.href,
        metadata: {
          reminderKey,
          whenLabel: when,
          classTitle: lesson.title,
        },
      });
    }
  }
  if (!rows.length) return { due: due.length, created: 0 };
  try {
    await db.insert(userNotifications).values(rows);
  } catch (error) {
    console.error("lesson_reminder_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { due: due.length, created: 0 };
  }
  return { due: due.length, created: rows.length };
}

async function dueLessons(
  actor: ApiActor,
  now: Date,
  horizon: Date,
  href: string,
): Promise<DueLesson[]> {
  const childRows =
    actor.roleKey === "parent"
      ? await db
          .select({ id: parentChildren.childUserId })
          .from(parentChildren)
          .where(eq(parentChildren.parentUserId, actor.userId))
      : [];
  const childIds = childRows.map((row) => row.id);
  const bookingScope = [
    eq(bookings.teacherUserId, actor.userId),
    eq(bookings.studentUserId, actor.userId),
    eq(bookings.bookedByUserId, actor.userId),
    childIds.length ? inArray(bookings.studentUserId, childIds) : undefined,
  ].filter((item) => item !== undefined);
  const lessonRows = await db
    .select({ id: bookings.id, startsAt: bookings.startsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "confirmed"),
        gt(bookings.startsAt, now),
        lte(bookings.startsAt, horizon),
        or(...bookingScope),
      ),
    )
    .limit(12);
  const groupRows =
    actor.roleKey === "teacher"
      ? await db
          .select({
            id: groupLessons.id,
            startsAt: groupLessons.startsAt,
            title: groupLessons.title,
          })
          .from(groupLessons)
          .where(
            and(
              eq(groupLessons.teacherUserId, actor.userId),
              eq(groupLessons.status, "published"),
              gt(groupLessons.startsAt, now),
              lte(groupLessons.startsAt, horizon),
            ),
          )
          .limit(12)
      : await db
          .select({
            id: groupLessons.id,
            startsAt: groupLessons.startsAt,
            title: groupLessons.title,
          })
          .from(groupLessons)
          .innerJoin(
            groupLessonEnrollments,
            eq(groupLessonEnrollments.groupLessonId, groupLessons.id),
          )
          .where(
            and(
              eq(groupLessons.status, "published"),
              eq(groupLessonEnrollments.status, "confirmed"),
              gt(groupLessons.startsAt, now),
              lte(groupLessons.startsAt, horizon),
              actor.roleKey === "parent"
                ? or(
                    eq(groupLessonEnrollments.bookedByUserId, actor.userId),
                    childIds.length
                      ? inArray(groupLessonEnrollments.studentUserId, childIds)
                      : eq(groupLessonEnrollments.bookedByUserId, actor.userId),
                  )
                : eq(groupLessonEnrollments.studentUserId, actor.userId),
            ),
          )
          .limit(12);

  const merged = new Map<string, DueLesson>();
  for (const row of lessonRows) {
    merged.set(`lesson:${row.id}`, {
      key: `lesson:${row.id}`,
      title: "Lesson",
      startsAt: row.startsAt,
      href,
    });
  }
  for (const row of groupRows) {
    merged.set(`group:${row.id}`, {
      key: `group:${row.id}`,
      title: row.title,
      startsAt: row.startsAt,
      href,
    });
  }
  return [...merged.values()];
}
