import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { studentProfiles } from "./profiles";

export const gamificationEvents = pgTable(
  "gamification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    title: varchar("title", { length: 160 }),
    points: integer("points").notNull(),
    stars: integer("stars").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("gamification_events_unique_idx").on(
      table.studentUserId,
      table.kind,
      table.sourceId,
    ),
    index("gamification_events_student_idx").on(table.studentUserId),
    index("gamification_events_created_idx").on(table.createdAt),
  ],
);

export const gamificationEventsRelations = relations(
  gamificationEvents,
  ({ one }) => ({
    student: one(studentProfiles, {
      fields: [gamificationEvents.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);
