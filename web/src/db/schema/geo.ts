import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { textDirectionEnum } from "./enums";

export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  symbol: varchar("symbol", { length: 8 }).notNull(),
  decimalPlaces: integer("decimal_places").notNull().default(2),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const locales = pgTable("locales", {
  code: varchar("code", { length: 8 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  direction: textDirectionEnum("direction").notNull().default("ltr"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baseCode: char("base_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    quoteCode: char("quote_code", { length: 3 })
      .notNull()
      .references(() => currencies.code, { onDelete: "restrict" }),
    rateInteger: bigint("rate_integer", { mode: "number" }).notNull(),
    rateScale: integer("rate_scale").notNull().default(8),
    asOf: timestamp("as_of", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("fx_rates_base_quote_idx").on(table.baseCode, table.quoteCode)],
);

export const countries = pgTable("countries", {
  iso2: char("iso2", { length: 2 }).primaryKey(),
  iso3: char("iso3", { length: 3 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  defaultTimezone: varchar("default_timezone", { length: 64 }).notNull(),
  defaultCurrencyCode: char("default_currency_code", { length: 3 })
    .notNull()
    .references(() => currencies.code, { onDelete: "restrict" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const currenciesRelations = relations(currencies, ({ many }) => ({
  countries: many(countries),
  fxBaseRates: many(fxRates, { relationName: "fxBase" }),
  fxQuoteRates: many(fxRates, { relationName: "fxQuote" }),
}));

export const fxRatesRelations = relations(fxRates, ({ one }) => ({
  base: one(currencies, {
    fields: [fxRates.baseCode],
    references: [currencies.code],
    relationName: "fxBase",
  }),
  quote: one(currencies, {
    fields: [fxRates.quoteCode],
    references: [currencies.code],
    relationName: "fxQuote",
  }),
}));

export const countriesRelations = relations(countries, ({ one }) => ({
  defaultCurrency: one(currencies, {
    fields: [countries.defaultCurrencyCode],
    references: [currencies.code],
  }),
}));
