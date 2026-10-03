import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { mobilePlatformEnum } from "./enums";
import { users } from "./identity";

export const mobileDevices = pgTable(
  "mobile_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: mobilePlatformEnum("platform").notNull(),
    appVersion: varchar("app_version", { length: 40 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("mobile_devices_user_platform_idx").on(
      table.userId,
      table.platform,
    ),
    index("mobile_devices_platform_idx").on(table.platform),
  ],
);

export const mobileDevicesRelations = relations(mobileDevices, ({ one }) => ({
  user: one(users, {
    fields: [mobileDevices.userId],
    references: [users.id],
  }),
}));
