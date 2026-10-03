import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { privacyConsentKindEnum } from "./enums";
import { users } from "./identity";

export const privacyConsents = pgTable(
  "privacy_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: privacyConsentKindEnum("kind").notNull(),
    granted: boolean("granted").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("privacy_consents_user_kind_idx").on(table.userId, table.kind),
  ],
);

export const privacyConsentsRelations = relations(privacyConsents, ({ one }) => ({
  user: one(users, {
    fields: [privacyConsents.userId],
    references: [users.id],
  }),
}));
