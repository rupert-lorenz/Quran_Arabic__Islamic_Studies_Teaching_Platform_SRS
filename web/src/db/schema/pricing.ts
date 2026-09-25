import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import { pricingControlScopeEnum } from "./enums";
import { countries } from "./geo";
import { teacherProfiles } from "./profiles";

export const pricingControls = pgTable(
  "pricing_controls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: pricingControlScopeEnum("scope").notNull(),
    scopeKey: varchar("scope_key", { length: 80 }).notNull(),
    minMinor: integer("min_minor"),
    maxMinor: integer("max_minor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("pricing_controls_scope_key_idx").on(table.scope, table.scopeKey),
    index("pricing_controls_scope_idx").on(table.scope),
  ],
);

export const pricingControlsRelations = relations(pricingControls, ({ one }) => ({
  country: one(countries, {
    fields: [pricingControls.scopeKey],
    references: [countries.iso2],
  }),
  subject: one(subjects, {
    fields: [pricingControls.scopeKey],
    references: [subjects.slug],
  }),
  teacher: one(teacherProfiles, {
    fields: [pricingControls.scopeKey],
    references: [teacherProfiles.userId],
  }),
}));
