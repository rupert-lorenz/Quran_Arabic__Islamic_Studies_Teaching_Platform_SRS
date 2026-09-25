import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { currencies } from "./geo";
import { users } from "./identity";
import { studentProfiles, teacherProfiles } from "./profiles";

export const bookingPackages = pgTable(
  "booking_packages",
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
    status: varchar("status", { length: 20 }).notNull().default("active"),
    lessonCount: integer("lesson_count").notNull(),
    discountPercent: integer("discount_percent").notNull(),
    perLessonAmountMinor: integer("per_lesson_amount_minor").notNull(),
    totalAmountMinor: integer("total_amount_minor").notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("booking_packages_teacher_idx").on(table.teacherUserId),
    index("booking_packages_student_idx").on(table.studentUserId),
    index("booking_packages_status_idx").on(table.status),
    check("booking_packages_count_check", sql`${table.lessonCount} between 2 and 24`),
    check(
      "booking_packages_discount_check",
      sql`${table.discountPercent} between 0 and 100`,
    ),
    check(
      "booking_packages_amount_check",
      sql`${table.perLessonAmountMinor} >= 0 and ${table.totalAmountMinor} >= 0`,
    ),
    check(
      "booking_packages_status_check",
      sql`${table.status} in ('active', 'cancelled', 'completed')`,
    ),
  ],
);
