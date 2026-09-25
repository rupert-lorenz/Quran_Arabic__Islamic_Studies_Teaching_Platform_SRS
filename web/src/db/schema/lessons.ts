import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { users } from "./identity";
import { studentProfiles, teacherProfiles } from "./profiles";

export const lessonHistory = pgTable(
  "lesson_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    teacherUserId: uuid("teacher_user_id").references(
      () => teacherProfiles.userId,
      { onDelete: "set null" },
    ),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "restrict" },
    ),
    title: varchar("title", { length: 160 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    attendedMinutes: integer("attended_minutes").notNull().default(0),
    notes: varchar("notes", { length: 500 }),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("lesson_history_student_idx").on(table.studentUserId),
    index("lesson_history_teacher_idx").on(table.teacherUserId),
    index("lesson_history_started_idx").on(table.startedAt),
  ],
);

export const lessonHistoryRelations = relations(lessonHistory, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [lessonHistory.studentUserId],
    references: [studentProfiles.userId],
  }),
  teacher: one(teacherProfiles, {
    fields: [lessonHistory.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  subject: one(subjects, {
    fields: [lessonHistory.subjectSlug],
    references: [subjects.slug],
  }),
  recordedBy: one(users, {
    fields: [lessonHistory.recordedByUserId],
    references: [users.id],
  }),
}));
