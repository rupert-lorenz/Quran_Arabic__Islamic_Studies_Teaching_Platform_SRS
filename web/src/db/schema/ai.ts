import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { classrooms, recordings } from "./classrooms";
import { users } from "./identity";
import type { AiTranscriptSegment } from "@/lib/ai-systems";

export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: varchar("kind", { length: 32 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("queued"),
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    sourceId: uuid("source_id"),
    classroomId: uuid("classroom_id").references(() => classrooms.id, {
      onDelete: "cascade",
    }),
    recordingId: uuid("recording_id").references(() => recordings.id, {
      onDelete: "set null",
    }),
    locale: varchar("locale", { length: 8 }).notNull().default("en"),
    title: varchar("title", { length: 180 }).notNull(),
    generatedByAi: boolean("generated_by_ai").notNull().default(true),
    requiresReview: boolean("requires_review").notNull().default(true),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    error: varchar("error", { length: 400 }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ai_jobs_classroom_idx").on(table.classroomId, table.createdAt),
    index("ai_jobs_kind_status_idx").on(table.kind, table.status),
    index("ai_jobs_created_by_idx").on(table.createdByUserId),
  ],
);

export const aiTranscripts = pgTable(
  "ai_transcripts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => aiJobs.id, { onDelete: "cascade" }),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id").references(() => recordings.id, {
      onDelete: "set null",
    }),
    locale: varchar("locale", { length: 8 }).notNull().default("en"),
    fullText: text("full_text").notNull().default(""),
    speakerCount: integer("speaker_count").notNull().default(0),
    generatedByAi: boolean("generated_by_ai").notNull().default(true),
    segments: jsonb("segments")
      .$type<AiTranscriptSegment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ai_transcripts_job_idx").on(table.jobId),
    index("ai_transcripts_classroom_idx").on(table.classroomId),
  ],
);

export const aiJobsRelations = relations(aiJobs, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [aiJobs.classroomId],
    references: [classrooms.id],
  }),
  recording: one(recordings, {
    fields: [aiJobs.recordingId],
    references: [recordings.id],
  }),
  createdBy: one(users, {
    fields: [aiJobs.createdByUserId],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [aiJobs.reviewedByUserId],
    references: [users.id],
  }),
  transcripts: many(aiTranscripts),
}));

export const aiTranscriptsRelations = relations(aiTranscripts, ({ one }) => ({
  job: one(aiJobs, {
    fields: [aiTranscripts.jobId],
    references: [aiJobs.id],
  }),
  classroom: one(classrooms, {
    fields: [aiTranscripts.classroomId],
    references: [classrooms.id],
  }),
  recording: one(recordings, {
    fields: [aiTranscripts.recordingId],
    references: [recordings.id],
  }),
}));
