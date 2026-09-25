import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { assessmentMarkingStatusEnum, teachingMaterialStatusEnum } from "./enums";
import { users } from "./identity";
import { studentProfiles } from "./profiles";
import type {
  QuizAnswerInput,
  QuizAnswerMark,
  QuizPayload,
  QuizSitOrder,
} from "@/lib/quizzes";

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    instructions: varchar("instructions", { length: 400 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    passPercent: integer("pass_percent").notNull().default(50),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    randomiseQuestions: boolean("randomise_questions").notNull().default(false),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    payload: jsonb("payload").$type<QuizPayload>().notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("exams_created_by_idx").on(table.createdByUserId),
    index("exams_status_idx").on(table.status),
    index("exams_opens_at_idx").on(table.opensAt),
  ],
);

export const examSittings = pgTable(
  "exam_sittings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    score: integer("score"),
    total: integer("total"),
    percent: integer("percent"),
    passed: boolean("passed"),
    markingStatus: assessmentMarkingStatusEnum("marking_status")
      .notNull()
      .default("auto"),
    answers: jsonb("answers")
      .$type<QuizAnswerInput[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    marks: jsonb("marks")
      .$type<QuizAnswerMark[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    questionOrder: jsonb("question_order")
      .$type<QuizSitOrder>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    uniqueIndex("exam_sittings_exam_student_uidx").on(
      table.examId,
      table.studentUserId,
    ),
    index("exam_sittings_exam_idx").on(table.examId),
    index("exam_sittings_student_idx").on(table.studentUserId),
  ],
);

export const examsRelations = relations(exams, ({ many }) => ({
  sittings: many(examSittings),
}));

export const examSittingsRelations = relations(examSittings, ({ one }) => ({
  exam: one(exams, {
    fields: [examSittings.examId],
    references: [exams.id],
  }),
  student: one(studentProfiles, {
    fields: [examSittings.studentUserId],
    references: [studentProfiles.userId],
  }),
}));
