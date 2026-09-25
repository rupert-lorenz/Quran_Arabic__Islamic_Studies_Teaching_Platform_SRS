import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import {
  documentReviewStatusEnum,
  teacherApplicationEventKindEnum,
  teacherDocumentTypeEnum,
  teacherInterviewStatusEnum,
  teacherVerificationEnum,
} from "./enums";
import { files } from "./files";
import { currencies } from "./geo";
import { users } from "./identity";

export const teacherProfiles = pgTable("teacher_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  hourlyRateMinor: integer("hourly_rate_minor"),
  currencyCode: char("currency_code", { length: 3 }).references(
    () => currencies.code,
    { onDelete: "restrict" },
  ),
  verificationStatus: teacherVerificationEnum("verification_status")
    .notNull()
    .default("application_started"),
  headline: varchar("headline", { length: 160 }),
  languages: varchar("languages", { length: 160 }),
  gender: varchar("gender", { length: 16 }),
  audiences: varchar("audiences", { length: 80 }),
  minNoticeMinutes: integer("min_notice_minutes"),
  minCommitmentLessons: integer("min_commitment_lessons"),
  offersGroupTeaching: boolean("offers_group_teaching").notNull().default(false),
  defaultGroupCapacity: integer("default_group_capacity").notNull().default(6),
  defaultGroupMinStudents: integer("default_group_min_students").notNull().default(2),
  introVideoFileId: uuid("intro_video_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: varchar("review_note", { length: 500 }),
  responseRate: integer("response_rate"),
  lessonsTaught: integer("lessons_taught").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
  currentLevel: varchar("current_level", { length: 40 }),
  languages: varchar("languages", { length: 160 }),
  gender: varchar("gender", { length: 16 }),
  about: varchar("about", { length: 1000 }),
  subjectInterests: varchar("subject_interests", { length: 160 }),
  parentManaged: boolean("parent_managed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const parentProfiles = pgTable("parent_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
  relationship: varchar("relationship", { length: 20 }),
  phone: varchar("phone", { length: 40 }),
  about: varchar("about", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const parentChildren = pgTable(
  "parent_children",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    childUserId: uuid("child_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("parent_children_parent_child_idx").on(
      table.parentUserId,
      table.childUserId,
    ),
  ],
);

export const learningGoals = pgTable(
  "learning_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "restrict" },
    ),
    kind: varchar("kind", { length: 40 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    detail: varchar("detail", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("learning_goals_student_idx").on(table.studentUserId),
    index("learning_goals_student_status_idx").on(
      table.studentUserId,
      table.status,
    ),
  ],
);

export const teacherAgreementVersions = pgTable("teacher_agreement_versions", {
  version: varchar("version", { length: 40 }).primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  clauses: text("clauses").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  publishedByUserId: uuid("published_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teacherAgreements = pgTable(
  "teacher_agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    version: varchar("version", { length: 40 }).notNull(),
    title: varchar("title", { length: 160 }).notNull().default("Teacher agreement"),
    clauseSnapshot: text("clause_snapshot"),
    contentHash: varchar("content_hash", { length: 64 }),
    signatureName: varchar("signature_name", { length: 160 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teacher_agreements_teacher_version_idx").on(
      table.teacherUserId,
      table.version,
    ),
    index("teacher_agreements_hash_idx").on(table.contentHash),
  ],
);

export const teacherDocumentReviews = pgTable(
  "teacher_document_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" })
      .unique(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    documentType: teacherDocumentTypeEnum("document_type").notNull().default("other"),
    status: documentReviewStatusEnum("status").notNull().default("pending"),
    note: varchar("note", { length: 500 }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("teacher_document_reviews_teacher_idx").on(table.teacherUserId),
    index("teacher_document_reviews_status_idx").on(table.status),
  ],
);

export const teacherInterviews = pgTable(
  "teacher_interviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    status: teacherInterviewStatusEnum("status").notNull().default("requested"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    meetingUrl: varchar("meeting_url", { length: 500 }),
    staffNote: varchar("staff_note", { length: 500 }),
    teacherNote: varchar("teacher_note", { length: 500 }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
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
    index("teacher_interviews_teacher_idx").on(table.teacherUserId),
    index("teacher_interviews_status_idx").on(table.status),
  ],
);

export const teacherApplicationEvents = pgTable(
  "teacher_application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    kind: teacherApplicationEventKindEnum("kind").notNull(),
    fromStatus: teacherVerificationEnum("from_status"),
    toStatus: teacherVerificationEnum("to_status"),
    interviewId: uuid("interview_id").references(() => teacherInterviews.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 500 }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("teacher_application_events_teacher_idx").on(table.teacherUserId),
    index("teacher_application_events_created_idx").on(table.createdAt),
  ],
);

export const teacherSubjects = pgTable(
  "teacher_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    subjectSlug: varchar("subject_slug", { length: 40 })
      .notNull()
      .references(() => subjects.slug, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teacher_subjects_teacher_subject_idx").on(
      table.teacherUserId,
      table.subjectSlug,
    ),
  ],
);

export const teacherProfilesRelations = relations(
  teacherProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [teacherProfiles.userId],
      references: [users.id],
    }),
    currency: one(currencies, {
      fields: [teacherProfiles.currencyCode],
      references: [currencies.code],
    }),
    introVideo: one(files, {
      fields: [teacherProfiles.introVideoFileId],
      references: [files.id],
    }),
    subjects: many(teacherSubjects),
    agreements: many(teacherAgreements),
    documentReviews: many(teacherDocumentReviews),
    interviews: many(teacherInterviews),
    applicationEvents: many(teacherApplicationEvents),
  }),
);

export const teacherInterviewsRelations = relations(
  teacherInterviews,
  ({ one, many }) => ({
    teacher: one(teacherProfiles, {
      fields: [teacherInterviews.teacherUserId],
      references: [teacherProfiles.userId],
    }),
    events: many(teacherApplicationEvents),
  }),
);

export const teacherApplicationEventsRelations = relations(
  teacherApplicationEvents,
  ({ one }) => ({
    teacher: one(teacherProfiles, {
      fields: [teacherApplicationEvents.teacherUserId],
      references: [teacherProfiles.userId],
    }),
    interview: one(teacherInterviews, {
      fields: [teacherApplicationEvents.interviewId],
      references: [teacherInterviews.id],
    }),
  }),
);

export const teacherDocumentReviewsRelations = relations(
  teacherDocumentReviews,
  ({ one }) => ({
    file: one(files, {
      fields: [teacherDocumentReviews.fileId],
      references: [files.id],
    }),
    teacher: one(teacherProfiles, {
      fields: [teacherDocumentReviews.teacherUserId],
      references: [teacherProfiles.userId],
    }),
  }),
);

export const teacherAgreementVersionsRelations = relations(
  teacherAgreementVersions,
  ({ many }) => ({
    signatures: many(teacherAgreements),
  }),
);

export const teacherAgreementsRelations = relations(
  teacherAgreements,
  ({ one }) => ({
    teacher: one(teacherProfiles, {
      fields: [teacherAgreements.teacherUserId],
      references: [teacherProfiles.userId],
    }),
    agreementVersion: one(teacherAgreementVersions, {
      fields: [teacherAgreements.version],
      references: [teacherAgreementVersions.version],
    }),
  }),
);

export const studentProfilesRelations = relations(
  studentProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [studentProfiles.userId],
      references: [users.id],
    }),
    learningGoals: many(learningGoals),
  }),
);

export const learningGoalsRelations = relations(learningGoals, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [learningGoals.studentUserId],
    references: [studentProfiles.userId],
  }),
  subject: one(subjects, {
    fields: [learningGoals.subjectSlug],
    references: [subjects.slug],
  }),
  createdBy: one(users, {
    fields: [learningGoals.createdByUserId],
    references: [users.id],
  }),
}));

export const parentProfilesRelations = relations(parentProfiles, ({ one }) => ({
  user: one(users, {
    fields: [parentProfiles.userId],
    references: [users.id],
  }),
}));

export const parentChildrenRelations = relations(parentChildren, ({ one }) => ({
  parent: one(users, {
    fields: [parentChildren.parentUserId],
    references: [users.id],
    relationName: "parentChildrenParent",
  }),
  child: one(users, {
    fields: [parentChildren.childUserId],
    references: [users.id],
    relationName: "parentChildrenChild",
  }),
}));

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacher: one(teacherProfiles, {
    fields: [teacherSubjects.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  subject: one(subjects, {
    fields: [teacherSubjects.subjectSlug],
    references: [subjects.slug],
  }),
}));
