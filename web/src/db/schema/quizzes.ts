import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { assessmentMarkingStatusEnum, teachingMaterialStatusEnum } from "./enums";
import { users } from "./identity";
import { studentProfiles } from "./profiles";
import type { QuizAnswerInput, QuizAnswerMark, QuizPayload } from "@/lib/quizzes";

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    instructions: varchar("instructions", { length: 400 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    passPercent: integer("pass_percent").notNull().default(70),
    attemptLimit: integer("attempt_limit").notNull().default(3),
    randomiseQuestions: boolean("randomise_questions").notNull().default(false),
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
    index("quizzes_created_by_idx").on(table.createdByUserId),
    index("quizzes_status_idx").on(table.status),
  ],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    percent: integer("percent").notNull(),
    passed: boolean("passed").notNull(),
    markingStatus: assessmentMarkingStatusEnum("marking_status")
      .notNull()
      .default("auto"),
    answers: jsonb("answers").$type<QuizAnswerInput[]>().notNull(),
    marks: jsonb("marks")
      .$type<QuizAnswerMark[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("quiz_attempts_quiz_idx").on(table.quizId),
    index("quiz_attempts_student_idx").on(table.studentUserId),
  ],
);

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  student: one(studentProfiles, {
    fields: [quizAttempts.studentUserId],
    references: [studentProfiles.userId],
  }),
}));
