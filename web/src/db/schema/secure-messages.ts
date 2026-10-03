import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const secureThreads = pgTable(
  "secure_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channel: varchar("channel", { length: 32 }).notNull(),
    participantLow: uuid("participant_low")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantHigh: uuid("participant_high")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("secure_threads_pair_idx").on(
      table.channel,
      table.participantLow,
      table.participantHigh,
    ),
    index("secure_threads_low_idx").on(table.participantLow),
    index("secure_threads_high_idx").on(table.participantHigh),
    check(
      "secure_threads_channel_check",
      sql`${table.channel} in ('teacher_student', 'teacher_parent', 'teacher_admin', 'family_admin')`,
    ),
    check(
      "secure_threads_pair_check",
      sql`${table.participantLow} <> ${table.participantHigh}`,
    ),
  ],
);

export const secureMessages = pgTable(
  "secure_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => secureThreads.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("secure_messages_thread_created_idx").on(table.threadId, table.createdAt),
  ],
);

export const secureThreadsRelations = relations(secureThreads, ({ many }) => ({
  messages: many(secureMessages),
}));

export const secureMessagesRelations = relations(secureMessages, ({ one }) => ({
  thread: one(secureThreads, {
    fields: [secureMessages.threadId],
    references: [secureThreads.id],
  }),
  sender: one(users, {
    fields: [secureMessages.senderUserId],
    references: [users.id],
  }),
}));
