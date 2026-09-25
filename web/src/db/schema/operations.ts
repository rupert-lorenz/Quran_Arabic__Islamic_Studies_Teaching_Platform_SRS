import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { studentProfiles } from "./profiles";
import {
  campaignChannelEnum,
  campaignStatusEnum,
  certificateStatusEnum,
  financeOperationKindEnum,
  financeOperationStatusEnum,
  incidentSeverityEnum,
  incidentStatusEnum,
  recordingReviewStatusEnum,
} from "./enums";
import { currencies, locales } from "./geo";
import { users } from "./identity";

export const financeOperations = pgTable(
  "finance_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: financeOperationKindEnum("kind").notNull(),
    status: financeOperationStatusEnum("status").notNull().default("open"),
    amountMinor: integer("amount_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    counterpartyUserId: uuid("counterparty_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reference: varchar("reference", { length: 120 }),
    notes: varchar("notes", { length: 500 }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
    index("finance_operations_kind_status_idx").on(table.kind, table.status),
    index("finance_operations_created_at_idx").on(table.createdAt),
  ],
);

export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    channel: campaignChannelEnum("channel").notNull().default("email"),
    locale: varchar("locale", { length: 8 }).references(() => locales.code, {
      onDelete: "set null",
    }),
    summary: varchar("summary", { length: 400 }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
    index("marketing_campaigns_status_idx").on(table.status),
    index("marketing_campaigns_created_at_idx").on(table.createdAt),
  ],
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    status: certificateStatusEnum("status").notNull().default("draft"),
    description: varchar("description", { length: 400 }),
    heading: varchar("heading", { length: 160 })
      .notNull()
      .default("Certificate of completion"),
    body: varchar("body", { length: 800 }),
    signOff: varchar("sign_off", { length: 160 })
      .notNull()
      .default("Al Haramain Schools"),
    awardKind: varchar("award_kind", { length: 20 }).notNull().default("manual"),
    awardSourceId: uuid("award_source_id"),
    passPercent: integer("pass_percent").notNull().default(0),
    autoIssue: boolean("auto_issue").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
  (table) => [index("certificates_status_idx").on(table.status)],
);

export const certificateAwards = pgTable(
  "certificate_awards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    issuedByUserId: uuid("issued_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceKind: varchar("source_kind", { length: 20 }).notNull().default("manual"),
    sourceId: uuid("source_id"),
    sourceTitle: varchar("source_title", { length: 160 }),
    heading: varchar("heading", { length: 160 }).notNull(),
    body: varchar("body", { length: 800 }).notNull(),
    signOff: varchar("sign_off", { length: 160 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("certificate_awards_unique_idx").on(
      table.certificateId,
      table.studentUserId,
    ),
    index("certificate_awards_student_idx").on(table.studentUserId),
    index("certificate_awards_certificate_idx").on(table.certificateId),
  ],
);

export const safeguardingIncidents = pgTable(
  "safeguarding_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    severity: incidentSeverityEnum("severity").notNull().default("medium"),
    status: incidentStatusEnum("status").notNull().default("open"),
    involvedUserId: uuid("involved_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    summary: varchar("summary", { length: 800 }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
    index("safeguarding_incidents_status_idx").on(table.status),
    index("safeguarding_incidents_severity_idx").on(table.severity),
  ],
);

export const safeguardingIncidentNotes = pgTable(
  "safeguarding_incident_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => safeguardingIncidents.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 800 }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("safeguarding_incident_notes_incident_idx").on(table.incidentId)],
);

export const safeguardingRecordingReviews = pgTable(
  "safeguarding_recording_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 160 }).notNull(),
    status: recordingReviewStatusEnum("status").notNull().default("flagged"),
    notes: varchar("notes", { length: 500 }),
    relatedUserId: uuid("related_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
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
    index("safeguarding_recording_reviews_status_idx").on(table.status),
  ],
);

export const financeOperationsRelations = relations(
  financeOperations,
  ({ one }) => ({
    currency: one(currencies, {
      fields: [financeOperations.currencyCode],
      references: [currencies.code],
    }),
    counterparty: one(users, {
      fields: [financeOperations.counterpartyUserId],
      references: [users.id],
    }),
  }),
);

export const marketingCampaignsRelations = relations(
  marketingCampaigns,
  ({ one }) => ({
    localeRecord: one(locales, {
      fields: [marketingCampaigns.locale],
      references: [locales.code],
    }),
  }),
);

export const certificatesRelations = relations(certificates, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [certificates.subjectSlug],
    references: [subjects.slug],
  }),
  awards: many(certificateAwards),
}));

export const certificateAwardsRelations = relations(certificateAwards, ({ one }) => ({
  certificate: one(certificates, {
    fields: [certificateAwards.certificateId],
    references: [certificates.id],
  }),
  student: one(studentProfiles, {
    fields: [certificateAwards.studentUserId],
    references: [studentProfiles.userId],
  }),
}));

export const safeguardingIncidentsRelations = relations(
  safeguardingIncidents,
  ({ one, many }) => ({
    involved: one(users, {
      fields: [safeguardingIncidents.involvedUserId],
      references: [users.id],
    }),
    notes: many(safeguardingIncidentNotes),
  }),
);

export const safeguardingIncidentNotesRelations = relations(
  safeguardingIncidentNotes,
  ({ one }) => ({
    incident: one(safeguardingIncidents, {
      fields: [safeguardingIncidentNotes.incidentId],
      references: [safeguardingIncidents.id],
    }),
  }),
);
