import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import {
  classroomParticipantRoleEnum,
  classroomRecordingStatusEnum,
  classroomStatusEnum,
} from "./enums";
import { groupLessons } from "./group-lessons";
import { files } from "./files";
import { users } from "./identity";
import { teacherProfiles } from "./profiles";

export type ClassroomWhiteboardStroke = {
  id: string;
  color: string;
  width: number;
  points: string;
  kind?:
    | "pen"
    | "highlight"
    | "line"
    | "arrow"
    | "rect"
    | "ellipse"
    | "triangle"
    | "text"
    | "image"
    | "erase"
    | "tajweed";
  text?: string;
  dir?: "ltr" | "rtl";
  rule?: string;
  fileId?: string;
  userId?: string;
  role?: "teacher" | "student" | "staff";
  displayName?: string;
};

export type ClassroomWhiteboardAction = {
  type: "add" | "remove" | "clear";
  userId?: string;
  strokes?: ClassroomWhiteboardStroke[];
};

export type ClassroomWhiteboardPage = {
  id: string;
  strokes: ClassroomWhiteboardStroke[];
  undo?: ClassroomWhiteboardAction[];
  redo?: ClassroomWhiteboardAction[];
  backgroundFileId?: string;
};

export type ClassroomWhiteboardDocument = {
  pages: ClassroomWhiteboardPage[];
  studentsCanAnnotate?: boolean;
  followPageId?: string;
};

export type ClassroomPresentationSlide = {
  id: string;
  title: string;
  body: string[];
  imageFileId?: string;
  dir?: "ltr" | "rtl";
  strokes?: ClassroomWhiteboardStroke[];
  undo?: ClassroomWhiteboardAction[];
  redo?: ClassroomWhiteboardAction[];
};

export type ClassroomPresentation = {
  fileId: string;
  name: string;
    kind: "pptx" | "pdf" | "epub";
  slideIndex: number;
  open: boolean;
  slides: ClassroomPresentationSlide[];
  bookmarks?: number[];
  followLocked?: boolean;
};

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    groupLessonId: uuid("group_lesson_id").references(() => groupLessons.id, {
      onDelete: "cascade",
    }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    subjectSlug: varchar("subject_slug", { length: 40 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    status: classroomStatusEnum("status").notNull().default("scheduled"),
    recordingEnabled: boolean("recording_enabled").notNull().default(false),
    joinOpensAt: timestamp("join_opens_at", { withTimezone: true }).notNull(),
    joinClosesAt: timestamp("join_closes_at", { withTimezone: true }).notNull(),
    whiteboard: jsonb("whiteboard")
      .$type<ClassroomWhiteboardDocument | ClassroomWhiteboardStroke[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    presentation: jsonb("presentation").$type<ClassroomPresentation | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("classrooms_booking_idx").on(table.bookingId),
    uniqueIndex("classrooms_group_lesson_idx").on(table.groupLessonId),
    index("classrooms_teacher_idx").on(table.teacherUserId, table.joinOpensAt),
    check(
      "classrooms_lesson_source_check",
      sql`(${table.bookingId} is not null and ${table.groupLessonId} is null)
        or (${table.bookingId} is null and ${table.groupLessonId} is not null)`,
    ),
    check(
      "classrooms_join_window_check",
      sql`${table.joinClosesAt} > ${table.joinOpensAt}`,
    ),
  ],
);

export const classroomParticipants = pgTable(
  "classroom_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: classroomParticipantRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    attendedSeconds: integer("attended_seconds").notNull().default(0),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("classroom_participants_room_user_idx").on(
      table.classroomId,
      table.userId,
    ),
    index("classroom_participants_user_idx").on(table.userId),
  ],
);

export const classroomMessages = pgTable(
  "classroom_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("classroom_messages_room_created_idx").on(
      table.classroomId,
      table.createdAt,
    ),
  ],
);

export const classroomFiles = pgTable(
  "classroom_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("classroom_files_file_idx").on(table.fileId),
    index("classroom_files_room_created_idx").on(
      table.classroomId,
      table.createdAt,
    ),
  ],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    startedByUserId: uuid("started_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: classroomRecordingStatusEnum("status").notNull().default("recording"),
    retained: boolean("retained").notNull().default(false),
    storageKey: varchar("storage_key", { length: 240 }),
    durationSeconds: integer("duration_seconds"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recordings_classroom_idx").on(table.classroomId, table.startedAt),
    check(
      "recordings_duration_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
  ],
);

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [classrooms.bookingId],
    references: [bookings.id],
  }),
  groupLesson: one(groupLessons, {
    fields: [classrooms.groupLessonId],
    references: [groupLessons.id],
  }),
  teacher: one(teacherProfiles, {
    fields: [classrooms.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  participants: many(classroomParticipants),
  messages: many(classroomMessages),
  files: many(classroomFiles),
  recordings: many(recordings),
}));

export const classroomParticipantsRelations = relations(
  classroomParticipants,
  ({ one }) => ({
    classroom: one(classrooms, {
      fields: [classroomParticipants.classroomId],
      references: [classrooms.id],
    }),
    user: one(users, {
      fields: [classroomParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const classroomMessagesRelations = relations(
  classroomMessages,
  ({ one }) => ({
    classroom: one(classrooms, {
      fields: [classroomMessages.classroomId],
      references: [classrooms.id],
    }),
    user: one(users, {
      fields: [classroomMessages.userId],
      references: [users.id],
    }),
  }),
);

export const classroomFilesRelations = relations(classroomFiles, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomFiles.classroomId],
    references: [classrooms.id],
  }),
  file: one(files, {
    fields: [classroomFiles.fileId],
    references: [files.id],
  }),
  uploadedBy: one(users, {
    fields: [classroomFiles.uploadedByUserId],
    references: [users.id],
  }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [recordings.classroomId],
    references: [classrooms.id],
  }),
  startedBy: one(users, {
    fields: [recordings.startedByUserId],
    references: [users.id],
  }),
}));
