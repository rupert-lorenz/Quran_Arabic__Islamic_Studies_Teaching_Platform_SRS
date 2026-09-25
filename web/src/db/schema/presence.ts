import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { classrooms } from "./classrooms";
import { users } from "./identity";

export const presenceEvents = pgTable(
  "presence_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    classroomId: uuid("classroom_id").references(() => classrooms.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 180 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("presence_events_user_idx").on(table.userId),
    index("presence_events_created_idx").on(table.createdAt),
    index("presence_events_kind_idx").on(table.kind),
  ],
);

export const presenceEventsRelations = relations(presenceEvents, ({ one }) => ({
  user: one(users, {
    fields: [presenceEvents.userId],
    references: [users.id],
  }),
  classroom: one(classrooms, {
    fields: [presenceEvents.classroomId],
    references: [classrooms.id],
  }),
}));
