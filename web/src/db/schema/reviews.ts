import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { teacherReviewStatusEnum } from "./enums";
import { users } from "./identity";
import { teacherProfiles } from "./profiles";

export const teacherReviews = pgTable(
  "teacher_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    recommend: boolean("recommend").notNull().default(true),
    status: teacherReviewStatusEnum("status").notNull().default("pending"),
    moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderationNote: varchar("moderation_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("teacher_reviews_teacher_parent_idx").on(
      table.teacherUserId,
      table.parentUserId,
    ),
    index("teacher_reviews_teacher_status_idx").on(
      table.teacherUserId,
      table.status,
    ),
  ],
);

export const teacherReviewsRelations = relations(teacherReviews, ({ one }) => ({
  teacher: one(teacherProfiles, {
    fields: [teacherReviews.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  parent: one(users, {
    fields: [teacherReviews.parentUserId],
    references: [users.id],
  }),
}));
