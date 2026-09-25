import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const subjects = pgTable("subjects", {
  slug: varchar("slug", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 255 }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
