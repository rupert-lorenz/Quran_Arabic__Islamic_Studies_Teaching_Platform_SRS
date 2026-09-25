import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type TeachingMaterialPage = {
  id: string;
  title: string;
  body: string[];
  imageFileId?: string;
  dir?: "ltr" | "rtl";
};
import { subjects } from "./catalog";
import {
  librarySubscriptionStatusEnum,
  teachingMaterialAccessModeEnum,
  teachingMaterialAudienceEnum,
  teachingMaterialCategoryEnum,
  teachingMaterialGrantSourceEnum,
  teachingMaterialRuleTypeEnum,
  teachingMaterialStatusEnum,
} from "./enums";
import { files } from "./files";
import { users } from "./identity";
import { studentProfiles } from "./profiles";

export const teachingMaterials = pgTable(
  "teaching_materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: varchar("description", { length: 400 }),
    category: teachingMaterialCategoryEnum("category").notNull(),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    fileId: uuid("file_id")
      .notNull()
      .unique()
      .references(() => files.id, { onDelete: "cascade" }),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    audience: teachingMaterialAudienceEnum("audience")
      .notNull()
      .default("learners"),
    accessMode: teachingMaterialAccessModeEnum("access_mode")
      .notNull()
      .default("open"),
    rentalDays: integer("rental_days"),
    isPurchasable: boolean("is_purchasable").notNull().default(false),
    downloadsRestricted: boolean("downloads_restricted").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    pages: jsonb("pages").$type<TeachingMaterialPage[] | null>(),
    pageCount: integer("page_count"),
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
    index("teaching_materials_category_idx").on(table.category),
    index("teaching_materials_status_idx").on(table.status),
    index("teaching_materials_subject_slug_idx").on(table.subjectSlug),
    index("teaching_materials_created_by_idx").on(table.createdByUserId),
  ],
);

export const teachingMaterialsRelations = relations(
  teachingMaterials,
  ({ one }) => ({
    subject: one(subjects, {
      fields: [teachingMaterials.subjectSlug],
      references: [subjects.slug],
    }),
    file: one(files, {
      fields: [teachingMaterials.fileId],
      references: [files.id],
    }),
    createdBy: one(users, {
      fields: [teachingMaterials.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const teachingMaterialAccessRules = pgTable(
  "teaching_material_access_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    ruleType: teachingMaterialRuleTypeEnum("rule_type").notNull(),
    ruleRef: varchar("rule_ref", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teaching_material_access_rules_unique_idx").on(
      table.materialId,
      table.ruleType,
      table.ruleRef,
    ),
    index("teaching_material_access_rules_material_idx").on(table.materialId),
  ],
);

export const teachingMaterialGrants = pgTable(
  "teaching_material_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    source: teachingMaterialGrantSourceEnum("source").notNull(),
    sourceRef: varchar("source_ref", { length: 80 }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("teaching_material_grants_student_idx").on(
      table.studentUserId,
      table.materialId,
    ),
    index("teaching_material_grants_material_idx").on(table.materialId),
  ],
);

export const librarySubscriptionPlans = pgTable("library_subscription_plans", {
  key: varchar("key", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 400 }),
  defaultDays: integer("default_days"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const librarySubscriptionPlanItems = pgTable(
  "library_subscription_plan_items",
  {
    planKey: varchar("plan_key", { length: 40 })
      .notNull()
      .references(() => librarySubscriptionPlans.key, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.planKey, table.materialId],
      name: "library_subscription_plan_items_pk",
    }),
    index("library_subscription_plan_items_material_idx").on(table.materialId),
  ],
);

export const librarySubscriptions = pgTable(
  "library_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    planKey: varchar("plan_key", { length: 40 })
      .notNull()
      .references(() => librarySubscriptionPlans.key, { onDelete: "cascade" }),
    status: librarySubscriptionStatusEnum("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("library_subscriptions_student_idx").on(table.studentUserId),
    index("library_subscriptions_plan_idx").on(table.planKey),
  ],
);

export const libraryLicencePools = pgTable("library_licence_pools", {
  key: varchar("key", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 400 }),
  seatLimit: integer("seat_limit"),
  defaultDays: integer("default_days"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const libraryLicencePoolItems = pgTable(
  "library_licence_pool_items",
  {
    poolKey: varchar("pool_key", { length: 40 })
      .notNull()
      .references(() => libraryLicencePools.key, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.poolKey, table.materialId],
      name: "library_licence_pool_items_pk",
    }),
    index("library_licence_pool_items_material_idx").on(table.materialId),
  ],
);

export const libraryLicenceSeats = pgTable(
  "library_licence_seats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolKey: varchar("pool_key", { length: 40 })
      .notNull()
      .references(() => libraryLicencePools.key, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    materialId: uuid("material_id").references(() => teachingMaterials.id, {
      onDelete: "cascade",
    }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("library_licence_seats_student_idx").on(table.studentUserId),
    index("library_licence_seats_pool_idx").on(table.poolKey),
  ],
);

export const libraryRentals = pgTable(
  "library_rentals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("library_rentals_student_idx").on(table.studentUserId, table.materialId),
    index("library_rentals_material_idx").on(table.materialId),
  ],
);

export const libraryPurchases = pgTable(
  "library_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("library_purchases_student_idx").on(
      table.studentUserId,
      table.materialId,
    ),
    index("library_purchases_material_idx").on(table.materialId),
  ],
);

export const prerecordedCourses = pgTable(
  "prerecorded_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: varchar("description", { length: 400 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    accessMode: teachingMaterialAccessModeEnum("access_mode")
      .notNull()
      .default("entitled"),
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
    index("prerecorded_courses_status_idx").on(table.status),
    index("prerecorded_courses_subject_slug_idx").on(table.subjectSlug),
  ],
);

export const prerecordedCourseLessons = pgTable(
  "prerecorded_course_lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => prerecordedCourses.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => teachingMaterials.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("prerecorded_course_lessons_unique_idx").on(
      table.courseId,
      table.materialId,
    ),
    index("prerecorded_course_lessons_course_idx").on(table.courseId),
    index("prerecorded_course_lessons_material_idx").on(table.materialId),
  ],
);

export const prerecordedCourseEnrollments = pgTable(
  "prerecorded_course_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => prerecordedCourses.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    enrolledByUserId: uuid("enrolled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("prerecorded_course_enrollments_unique_idx").on(
      table.courseId,
      table.studentUserId,
    ),
    index("prerecorded_course_enrollments_student_idx").on(table.studentUserId),
    index("prerecorded_course_enrollments_course_idx").on(table.courseId),
  ],
);

export const prerecordedCourseProgress = pgTable(
  "prerecorded_course_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => prerecordedCourses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => prerecordedCourseLessons.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("prerecorded_course_progress_unique_idx").on(
      table.lessonId,
      table.studentUserId,
    ),
    index("prerecorded_course_progress_course_student_idx").on(
      table.courseId,
      table.studentUserId,
    ),
  ],
);

export const teachingMaterialAccessRulesRelations = relations(
  teachingMaterialAccessRules,
  ({ one }) => ({
    material: one(teachingMaterials, {
      fields: [teachingMaterialAccessRules.materialId],
      references: [teachingMaterials.id],
    }),
  }),
);

export const teachingMaterialGrantsRelations = relations(
  teachingMaterialGrants,
  ({ one }) => ({
    material: one(teachingMaterials, {
      fields: [teachingMaterialGrants.materialId],
      references: [teachingMaterials.id],
    }),
    student: one(studentProfiles, {
      fields: [teachingMaterialGrants.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);

export const librarySubscriptionsRelations = relations(
  librarySubscriptions,
  ({ one }) => ({
    plan: one(librarySubscriptionPlans, {
      fields: [librarySubscriptions.planKey],
      references: [librarySubscriptionPlans.key],
    }),
    student: one(studentProfiles, {
      fields: [librarySubscriptions.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);

export const librarySubscriptionPlanItemsRelations = relations(
  librarySubscriptionPlanItems,
  ({ one }) => ({
    plan: one(librarySubscriptionPlans, {
      fields: [librarySubscriptionPlanItems.planKey],
      references: [librarySubscriptionPlans.key],
    }),
    material: one(teachingMaterials, {
      fields: [librarySubscriptionPlanItems.materialId],
      references: [teachingMaterials.id],
    }),
  }),
);

export const libraryLicencePoolItemsRelations = relations(
  libraryLicencePoolItems,
  ({ one }) => ({
    pool: one(libraryLicencePools, {
      fields: [libraryLicencePoolItems.poolKey],
      references: [libraryLicencePools.key],
    }),
    material: one(teachingMaterials, {
      fields: [libraryLicencePoolItems.materialId],
      references: [teachingMaterials.id],
    }),
  }),
);

export const libraryLicenceSeatsRelations = relations(
  libraryLicenceSeats,
  ({ one }) => ({
    pool: one(libraryLicencePools, {
      fields: [libraryLicenceSeats.poolKey],
      references: [libraryLicencePools.key],
    }),
    student: one(studentProfiles, {
      fields: [libraryLicenceSeats.studentUserId],
      references: [studentProfiles.userId],
    }),
    material: one(teachingMaterials, {
      fields: [libraryLicenceSeats.materialId],
      references: [teachingMaterials.id],
    }),
  }),
);

export const libraryRentalsRelations = relations(libraryRentals, ({ one }) => ({
  material: one(teachingMaterials, {
    fields: [libraryRentals.materialId],
    references: [teachingMaterials.id],
  }),
  student: one(studentProfiles, {
    fields: [libraryRentals.studentUserId],
    references: [studentProfiles.userId],
  }),
}));

export const libraryPurchasesRelations = relations(libraryPurchases, ({ one }) => ({
  material: one(teachingMaterials, {
    fields: [libraryPurchases.materialId],
    references: [teachingMaterials.id],
  }),
  student: one(studentProfiles, {
    fields: [libraryPurchases.studentUserId],
    references: [studentProfiles.userId],
  }),
}));

export const prerecordedCourseProgressRelations = relations(
  prerecordedCourseProgress,
  ({ one }) => ({
    course: one(prerecordedCourses, {
      fields: [prerecordedCourseProgress.courseId],
      references: [prerecordedCourses.id],
    }),
    lesson: one(prerecordedCourseLessons, {
      fields: [prerecordedCourseProgress.lessonId],
      references: [prerecordedCourseLessons.id],
    }),
    student: one(studentProfiles, {
      fields: [prerecordedCourseProgress.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);
