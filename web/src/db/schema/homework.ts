import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import {
  homeworkFileKindEnum,
  homeworkStatusEnum,
  homeworkWorkStatusEnum,
} from "./enums";
import { files } from "./files";
import { users } from "./identity";
import { studentProfiles } from "./profiles";

export const homeworks = pgTable(
  "homeworks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    instructions: varchar("instructions", { length: 4000 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: homeworkStatusEnum("status").notNull().default("draft"),
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
    index("homeworks_created_by_idx").on(table.createdByUserId),
    index("homeworks_status_idx").on(table.status),
    index("homeworks_due_at_idx").on(table.dueAt),
  ],
);

export const homeworkWork = pgTable(
  "homework_work",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homeworks.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    status: homeworkWorkStatusEnum("status").notNull().default("assigned"),
    submissionText: varchar("submission_text", { length: 4000 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    markLabel: varchar("mark_label", { length: 40 }),
    feedback: varchar("feedback", { length: 2000 }),
    markedAt: timestamp("marked_at", { withTimezone: true }),
    markedByUserId: uuid("marked_by_user_id").references(() => users.id, {
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
    uniqueIndex("homework_work_unique_idx").on(
      table.homeworkId,
      table.studentUserId,
    ),
    index("homework_work_student_idx").on(table.studentUserId),
    index("homework_work_homework_idx").on(table.homeworkId),
  ],
);

export const homeworkFiles = pgTable(
  "homework_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homeworks.id, { onDelete: "cascade" }),
    workId: uuid("work_id").references(() => homeworkWork.id, {
      onDelete: "cascade",
    }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    kind: homeworkFileKindEnum("kind").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("homework_files_homework_idx").on(table.homeworkId),
    index("homework_files_work_idx").on(table.workId),
  ],
);

export const homeworksRelations = relations(homeworks, ({ many }) => ({
  work: many(homeworkWork),
  files: many(homeworkFiles),
}));

export const homeworkWorkRelations = relations(homeworkWork, ({ one, many }) => ({
  homework: one(homeworks, {
    fields: [homeworkWork.homeworkId],
    references: [homeworks.id],
  }),
  student: one(studentProfiles, {
    fields: [homeworkWork.studentUserId],
    references: [studentProfiles.userId],
  }),
  files: many(homeworkFiles),
}));

export const homeworkFilesRelations = relations(homeworkFiles, ({ one }) => ({
  homework: one(homeworks, {
    fields: [homeworkFiles.homeworkId],
    references: [homeworks.id],
  }),
  work: one(homeworkWork, {
    fields: [homeworkFiles.workId],
    references: [homeworkWork.id],
  }),
  file: one(files, {
    fields: [homeworkFiles.fileId],
    references: [files.id],
  }),
}));
