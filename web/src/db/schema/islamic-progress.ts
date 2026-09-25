import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { studentProfiles } from "./profiles";
import { users } from "./identity";

export const islamicProgress = pgTable(
  "islamic_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    track: varchar("track", { length: 20 }).notNull(),
    surah: integer("surah"),
    juz: integer("juz"),
    page: integer("page"),
    ayah: integer("ayah"),
    quranMode: varchar("quran_mode", { length: 20 }),
    reading: integer("reading"),
    writing: integer("writing"),
    speaking: integer("speaking"),
    listening: integer("listening"),
    vocabulary: integer("vocabulary"),
    grammar: integer("grammar"),
    bookTitle: varchar("book_title", { length: 160 }),
    pagesNote: varchar("pages_note", { length: 80 }),
    courseTitle: varchar("course_title", { length: 160 }),
    homeworkStatus: varchar("homework_status", { length: 20 }),
    assessmentStatus: varchar("assessment_status", { length: 20 }),
    levelLabel: varchar("level_label", { length: 80 }),
    unitLabel: varchar("unit_label", { length: 80 }),
    lessonLabel: varchar("lesson_label", { length: 160 }),
    weeklyTarget: varchar("weekly_target", { length: 240 }),
    nextLessonTarget: varchar("next_lesson_target", { length: 240 }),
    completionPercent: integer("completion_percent"),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("islamic_progress_student_track_idx").on(
      table.studentUserId,
      table.track,
    ),
    index("islamic_progress_student_idx").on(table.studentUserId),
    index("islamic_progress_track_idx").on(table.track),
  ],
);

export const islamicProgressQuranStreams = pgTable(
  "islamic_progress_quran_streams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    progressId: uuid("progress_id")
      .notNull()
      .references(() => islamicProgress.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 20 }).notNull(),
    surah: integer("surah"),
    juz: integer("juz"),
    page: integer("page"),
    ayah: integer("ayah"),
    percent: integer("percent"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("islamic_progress_quran_streams_unique_idx").on(
      table.progressId,
      table.mode,
    ),
    index("islamic_progress_quran_streams_progress_idx").on(table.progressId),
  ],
);

export const islamicProgressNotes = pgTable(
  "islamic_progress_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    progressId: uuid("progress_id")
      .notNull()
      .references(() => islamicProgress.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 1000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("islamic_progress_notes_progress_idx").on(table.progressId),
    index("islamic_progress_notes_created_idx").on(table.createdAt),
  ],
);

export const islamicProgressRelations = relations(
  islamicProgress,
  ({ one, many }) => ({
    student: one(studentProfiles, {
      fields: [islamicProgress.studentUserId],
      references: [studentProfiles.userId],
    }),
    updatedBy: one(users, {
      fields: [islamicProgress.updatedByUserId],
      references: [users.id],
    }),
    notes: many(islamicProgressNotes),
    quranStreams: many(islamicProgressQuranStreams),
  }),
);

export const islamicProgressQuranStreamsRelations = relations(
  islamicProgressQuranStreams,
  ({ one }) => ({
    progress: one(islamicProgress, {
      fields: [islamicProgressQuranStreams.progressId],
      references: [islamicProgress.id],
    }),
  }),
);

export const islamicProgressNotesRelations = relations(
  islamicProgressNotes,
  ({ one }) => ({
    progress: one(islamicProgress, {
      fields: [islamicProgressNotes.progressId],
      references: [islamicProgress.id],
    }),
    author: one(users, {
      fields: [islamicProgressNotes.authorUserId],
      references: [users.id],
    }),
  }),
);
