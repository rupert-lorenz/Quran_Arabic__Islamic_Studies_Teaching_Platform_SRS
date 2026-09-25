import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
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
import { studentProfiles, teacherProfiles } from "./profiles";

export const liveCourses = pgTable(
  "live_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    subjectSlug: varchar("subject_slug", { length: 40 })
      .notNull()
      .references(() => subjects.slug, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: varchar("description", { length: 1500 }),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    firstStartsAt: timestamp("first_starts_at", { withTimezone: true }).notNull(),
    lastEndsAt: timestamp("last_ends_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    sessionCount: integer("session_count").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    capacity: integer("capacity").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("live_courses_teacher_start_idx").on(table.teacherUserId, table.firstStartsAt),
    index("live_courses_status_start_idx").on(table.status, table.firstStartsAt),
    check("live_courses_capacity_check", sql`${table.capacity} between 2 and 50`),
    check("live_courses_sessions_check", sql`${table.sessionCount} between 2 and 24`),
    check("live_courses_amount_check", sql`${table.amountMinor} >= 0`),
  ],
);

export const liveCourseEnrollments = pgTable(
  "live_course_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    liveCourseId: uuid("live_course_id")
      .notNull()
      .references(() => liveCourses.id, { onDelete: "cascade" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("live_course_enrollments_course_idx").on(table.liveCourseId),
    index("live_course_enrollments_student_idx").on(table.studentUserId),
    uniqueIndex("live_course_enrollments_course_student_idx").on(
      table.liveCourseId,
      table.studentUserId,
    ),
  ],
);

export const liveCoursesRelations = relations(liveCourses, ({ one, many }) => ({
  teacher: one(teacherProfiles, {
    fields: [liveCourses.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  subject: one(subjects, {
    fields: [liveCourses.subjectSlug],
    references: [subjects.slug],
  }),
  enrollments: many(liveCourseEnrollments),
}));

export const liveCourseEnrollmentsRelations = relations(
  liveCourseEnrollments,
  ({ one }) => ({
    course: one(liveCourses, {
      fields: [liveCourseEnrollments.liveCourseId],
      references: [liveCourses.id],
    }),
    student: one(studentProfiles, {
      fields: [liveCourseEnrollments.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);
