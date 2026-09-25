import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const userTotp = pgTable("user_totp", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: varchar("secret_encrypted", { length: 255 }).notNull(),
  enabledAt: timestamp("enabled_at", { withTimezone: true }).notNull(),
  lastUsedStep: varchar("last_used_step", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const totpRecoveryCodes = pgTable(
  "totp_recovery_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("totp_recovery_codes_user_hash_idx").on(
      table.userId,
      table.codeHash,
    ),
    index("totp_recovery_codes_user_id_idx").on(table.userId),
  ],
);

export const userTotpRelations = relations(userTotp, ({ one }) => ({
  user: one(users, {
    fields: [userTotp.userId],
    references: [users.id],
  }),
}));

export const totpRecoveryCodesRelations = relations(
  totpRecoveryCodes,
  ({ one }) => ({
    user: one(users, {
      fields: [totpRecoveryCodes.userId],
      references: [users.id],
    }),
  }),
);
