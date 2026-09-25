import { relations, sql } from "drizzle-orm";
import {
    char,
    check,
    date,
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { bookingStatusEnum } from "./enums";
import { currencies } from "./geo";
import { users } from "./identity";
import { lessonHistory } from "./lessons";
import { liveCourses } from "./live-courses";
import { studentProfiles, teacherProfiles } from "./profiles";

export const groupLessons = pgTable(
  "group_lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    liveCourseId: uuid("live_course_id").references(() => liveCourses.id, {
      onDelete: "cascade",
    }),
    courseSessionIndex: integer("course_session_index"),
    courseSessionTotal: integer("course_session_total"),
    seriesId: uuid("series_id"),
    seriesIndex: integer("series_index"),
    seriesTotal: integer("series_total"),
    subjectSlug: varchar("subject_slug", { length: 40 })
      .notNull()
      .references(() => subjects.slug, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: varchar("description", { length: 1000 }),
    level: varchar("level", { length: 24 }).notNull().default("all_levels"),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    weekdays: varchar("weekdays", { length: 32 }),
    weekInterval: integer("week_interval").notNull().default(1),
    durationMinutes: integer("duration_minutes").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    capacity: integer("capacity").notNull(),
    minStudents: integer("min_students").notNull().default(2),
    amountMinor: integer("amount_minor").notNull(),
    teacherPaymentMinor: integer("teacher_payment_minor"),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    visibleFrom: timestamp("visible_from", { withTimezone: true }),
    applicationDeadline: timestamp("application_deadline", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("group_lessons_teacher_starts_idx").on(table.teacherUserId, table.startsAt),
    index("group_lessons_status_starts_idx").on(table.status, table.startsAt),
    index("group_lessons_live_course_idx").on(table.liveCourseId),
    index("group_lessons_series_idx").on(table.seriesId),
    check("group_lessons_capacity_check", sql`${table.capacity} between 2 and 50`),
    check(
      "group_lessons_min_students_check",
      sql`${table.minStudents} between 2 and 50 and ${table.minStudents} <= ${table.capacity}`,
    ),
    check("group_lessons_duration_check", sql`${table.durationMinutes} between 15 and 180`),
    check("group_lessons_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "group_lessons_teacher_payment_check",
      sql`${table.teacherPaymentMinor} is null or ${table.teacherPaymentMinor} >= 0`,
    ),
    check(
      "group_lessons_level_check",
      sql`${table.level} in ('all_levels', 'beginner', 'intermediate', 'advanced')`,
    ),
    check(
      "group_lessons_age_check",
      sql`(${table.minAge} is null or ${table.minAge} between 3 and 99)
        and (${table.maxAge} is null or ${table.maxAge} between 3 and 99)
        and (${table.minAge} is null or ${table.maxAge} is null or ${table.minAge} <= ${table.maxAge})`,
    ),
    check(
      "group_lessons_status_check",
      sql`${table.status} in ('published', 'cancelled', 'completed')`,
    ),
    check("group_lessons_time_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "group_lessons_week_interval_check",
      sql`${table.weekInterval} between 1 and 4`,
    ),
    check(
      "group_lessons_schedule_dates_check",
      sql`${table.startsOn} is null or ${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn}`,
    ),
    check(
      "group_lessons_visibility_check",
      sql`${table.visibleFrom} is null or ${table.visibleFrom} <= ${table.startsAt}`,
    ),
    check(
      "group_lessons_application_deadline_check",
      sql`${table.applicationDeadline} is null or ${table.applicationDeadline} <= ${table.startsAt}`,
    ),
    check(
      "group_lessons_visibility_deadline_check",
      sql`${table.visibleFrom} is null or ${table.applicationDeadline} is null or ${table.visibleFrom} <= ${table.applicationDeadline}`,
    ),
  ],
);

export const groupLessonEnrollments = pgTable(
  "group_lesson_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupLessonId: uuid("group_lesson_id")
      .notNull()
      .references(() => groupLessons.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "restrict" }),
    bookedByUserId: uuid("booked_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    amountMinor: integer("amount_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    lessonHistoryId: uuid("lesson_history_id").references(() => lessonHistory.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("group_enrollments_lesson_idx").on(table.groupLessonId),
    index("group_enrollments_student_idx").on(table.studentUserId),
    uniqueIndex("group_enrollments_lesson_student_idx").on(
      table.groupLessonId,
      table.studentUserId,
    ),
  ],
);

export const groupLessonsRelations = relations(groupLessons, ({ one, many }) => ({
  teacher: one(teacherProfiles, {
    fields: [groupLessons.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  subject: one(subjects, {
    fields: [groupLessons.subjectSlug],
    references: [subjects.slug],
  }),
  enrollments: many(groupLessonEnrollments),
}));

export const groupLessonEnrollmentsRelations = relations(
  groupLessonEnrollments,
  ({ one }) => ({
    lesson: one(groupLessons, {
      fields: [groupLessonEnrollments.groupLessonId],
      references: [groupLessons.id],
    }),
    student: one(studentProfiles, {
      fields: [groupLessonEnrollments.studentUserId],
      references: [studentProfiles.userId],
    }),
    bookedBy: one(users, {
      fields: [groupLessonEnrollments.bookedByUserId],
      references: [users.id],
    }),
  }),
);
