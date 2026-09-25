import { relations, sql } from "drizzle-orm";
import {
  char,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import {
  availabilityKindEnum,
  bookingCancelOutcomeEnum,
  bookingEventKindEnum,
  bookingKindEnum,
  bookingStatusEnum,
} from "./enums";
import { currencies } from "./geo";
import { users } from "./identity";
import { lessonHistory } from "./lessons";
import { bookingPackages } from "./booking-packages";
import { financeOperations } from "./operations";
import { studentProfiles, teacherProfiles } from "./profiles";

export const teacherAvailability = pgTable(
  "teacher_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    kind: availabilityKindEnum("kind").notNull(),
    weekday: integer("weekday"),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    localDate: date("local_date"),
    recurrenceGroupId: uuid("recurrence_group_id"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    weekInterval: integer("week_interval").notNull().default(1),
    replacesRecurring: boolean("replaces_recurring").notNull().default(false),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    note: varchar("note", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("teacher_availability_teacher_idx").on(table.teacherUserId),
    index("teacher_availability_kind_idx").on(table.teacherUserId, table.kind),
    index("teacher_availability_group_idx").on(table.recurrenceGroupId),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "restrict" }),
    bookedByUserId: uuid("booked_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    subjectSlug: varchar("subject_slug", { length: 40 })
      .notNull()
      .references(() => subjects.slug, { onDelete: "restrict" }),
    kind: bookingKindEnum("kind").notNull().default("lesson"),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    seriesId: uuid("series_id"),
    seriesIndex: integer("series_index"),
    seriesTotal: integer("series_total"),
    packageId: uuid("package_id").references(() => bookingPackages.id, {
      onDelete: "set null",
    }),
    amountMinor: integer("amount_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    cancelOutcome: bookingCancelOutcomeEnum("cancel_outcome"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelReason: varchar("cancel_reason", { length: 500 }),
    cancelFinancialAction: varchar("cancel_financial_action", { length: 20 }),
    cancelFinanceOperationId: uuid("cancel_finance_operation_id").references(
      () => financeOperations.id,
      { onDelete: "set null" },
    ),
    lessonHistoryId: uuid("lesson_history_id").references(() => lessonHistory.id, {
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
    index("bookings_teacher_starts_idx").on(table.teacherUserId, table.startsAt),
    index("bookings_student_starts_idx").on(table.studentUserId, table.startsAt),
    index("bookings_booked_by_idx").on(table.bookedByUserId),
    index("bookings_status_idx").on(table.status),
    index("bookings_series_idx").on(table.seriesId),
    index("bookings_package_idx").on(table.packageId),
    index("bookings_cancel_finance_idx").on(table.cancelFinanceOperationId),
    uniqueIndex("bookings_teacher_confirmed_slot_idx")
      .on(table.teacherUserId, table.startsAt)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex("bookings_student_confirmed_slot_idx")
      .on(table.studentUserId, table.startsAt)
      .where(sql`${table.status} = 'confirmed'`),
    uniqueIndex("bookings_teacher_student_trial_idx")
      .on(table.teacherUserId, table.studentUserId)
      .where(
        sql`${table.kind} = 'trial' and ${table.status} <> 'cancelled'`,
      ),
  ],
);

export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: bookingEventKindEnum("kind").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 20 }).notNull(),
    note: varchar("note", { length: 500 }),
    fromStartsAt: timestamp("from_starts_at", { withTimezone: true }),
    toStartsAt: timestamp("to_starts_at", { withTimezone: true }),
    outcome: bookingCancelOutcomeEnum("outcome"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("booking_events_booking_idx").on(table.bookingId),
    index("booking_events_created_idx").on(table.createdAt),
  ],
);

export const teacherAvailabilityRelations = relations(
  teacherAvailability,
  ({ one }) => ({
    teacher: one(teacherProfiles, {
      fields: [teacherAvailability.teacherUserId],
      references: [teacherProfiles.userId],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  teacher: one(teacherProfiles, {
    fields: [bookings.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  student: one(studentProfiles, {
    fields: [bookings.studentUserId],
    references: [studentProfiles.userId],
  }),
  bookedBy: one(users, {
    fields: [bookings.bookedByUserId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [bookings.subjectSlug],
    references: [subjects.slug],
  }),
  package: one(bookingPackages, {
    fields: [bookings.packageId],
    references: [bookingPackages.id],
  }),
  events: many(bookingEvents),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingEvents.bookingId],
    references: [bookings.id],
  }),
  actor: one(users, {
    fields: [bookingEvents.actorUserId],
    references: [users.id],
  }),
}));
