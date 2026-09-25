import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { locales } from "./geo";

export const translations = pgTable(
  "translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityKey: varchar("entity_key", { length: 80 }).notNull(),
    locale: varchar("locale", { length: 8 })
      .notNull()
      .references(() => locales.code, { onDelete: "restrict" }),
    field: varchar("field", { length: 40 }).notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("translations_entity_locale_field_idx").on(
      table.entityType,
      table.entityKey,
      table.locale,
      table.field,
    ),
  ],
);

export const translationsRelations = relations(translations, ({ one }) => ({
  localeRecord: one(locales, {
    fields: [translations.locale],
    references: [locales.code],
  }),
}));
