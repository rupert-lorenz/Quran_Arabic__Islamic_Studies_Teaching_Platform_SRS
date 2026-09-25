import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { currencies } from "./geo";
import { groupLessons } from "./group-lessons";
import { users } from "./identity";
import { teacherProfiles } from "./profiles";

export const groupClassOpportunities = pgTable(
  "group_class_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectSlug: varchar("subject_slug", { length: 40 })
      .notNull()
      .references(() => subjects.slug, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: varchar("description", { length: 1000 }),
    level: varchar("level", { length: 24 }).notNull().default("all_levels"),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    weekdays: varchar("weekdays", { length: 32 }).notNull(),
    weekInterval: integer("week_interval").notNull().default(1),
    durationMinutes: integer("duration_minutes").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    capacity: integer("capacity").notNull(),
    minStudents: integer("min_students").notNull().default(2),
    amountMinor: integer("amount_minor").notNull(),
    teacherPaymentMinor: integer("teacher_payment_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    visibleFrom: timestamp("visible_from", { withTimezone: true }),
    applicationDeadline: timestamp("application_deadline", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    selectedApplicationId: uuid("selected_application_id"),
    selectedGroupLessonId: uuid("selected_group_lesson_id").references(
      () => groupLessons.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("group_opportunities_status_starts_idx").on(table.status, table.startsAt),
    index("group_opportunities_subject_idx").on(table.subjectSlug, table.startsAt),
    check("group_opportunities_capacity_check", sql`${table.capacity} between 2 and 50`),
    check(
      "group_opportunities_min_students_check",
      sql`${table.minStudents} between 2 and 50 and ${table.minStudents} <= ${table.capacity}`,
    ),
    check(
      "group_opportunities_duration_check",
      sql`${table.durationMinutes} between 15 and 180`,
    ),
    check("group_opportunities_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "group_opportunities_teacher_payment_check",
      sql`${table.teacherPaymentMinor} >= 0`,
    ),
    check(
      "group_opportunities_level_check",
      sql`${table.level} in ('all_levels', 'beginner', 'intermediate', 'advanced')`,
    ),
    check(
      "group_opportunities_age_check",
      sql`(${table.minAge} is null or ${table.minAge} between 3 and 99)
        and (${table.maxAge} is null or ${table.maxAge} between 3 and 99)
        and (${table.minAge} is null or ${table.maxAge} is null or ${table.minAge} <= ${table.maxAge})`,
    ),
    check(
      "group_opportunities_status_check",
      sql`${table.status} in ('open', 'closed', 'cancelled', 'filled')`,
    ),
    check("group_opportunities_time_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "group_opportunities_week_interval_check",
      sql`${table.weekInterval} between 1 and 4`,
    ),
    check(
      "group_opportunities_schedule_dates_check",
      sql`${table.endsOn} >= ${table.startsOn}`,
    ),
    check(
      "group_opportunities_visibility_check",
      sql`${table.visibleFrom} is null or ${table.visibleFrom} <= ${table.startsAt}`,
    ),
    check(
      "group_opportunities_application_deadline_check",
      sql`${table.applicationDeadline} is null or ${table.applicationDeadline} <= ${table.startsAt}`,
    ),
    check(
      "group_opportunities_visibility_deadline_check",
      sql`${table.visibleFrom} is null or ${table.applicationDeadline} is null or ${table.visibleFrom} <= ${table.applicationDeadline}`,
    ),
  ],
);

export const groupClassApplications = pgTable(
  "group_class_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => groupClassOpportunities.id, { onDelete: "cascade" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    bidMinor: integer("bid_minor").notNull(),
    message: varchar("message", { length: 1000 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("group_opportunity_apps_opportunity_idx").on(table.opportunityId),
    index("group_opportunity_apps_teacher_idx").on(table.teacherUserId),
    uniqueIndex("group_opportunity_apps_unique_idx").on(
      table.opportunityId,
      table.teacherUserId,
    ),
    check("group_opportunity_apps_bid_check", sql`${table.bidMinor} >= 0`),
    check(
      "group_opportunity_apps_status_check",
      sql`${table.status} in ('pending', 'withdrawn', 'accepted', 'rejected')`,
    ),
  ],
);

export const groupClassOpportunitiesRelations = relations(
  groupClassOpportunities,
  ({ one, many }) => ({
    subject: one(subjects, {
      fields: [groupClassOpportunities.subjectSlug],
      references: [subjects.slug],
    }),
    createdBy: one(users, {
      fields: [groupClassOpportunities.createdByUserId],
      references: [users.id],
    }),
    applications: many(groupClassApplications),
  }),
);

export const groupClassApplicationsRelations = relations(
  groupClassApplications,
  ({ one }) => ({
    opportunity: one(groupClassOpportunities, {
      fields: [groupClassApplications.opportunityId],
      references: [groupClassOpportunities.id],
    }),
    teacher: one(teacherProfiles, {
      fields: [groupClassApplications.teacherUserId],
      references: [teacherProfiles.userId],
    }),
  }),
);
