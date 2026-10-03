import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import {
  crmAccountStatusEnum,
  supportTicketCategoryEnum,
  supportTicketPriorityEnum,
  supportTicketStatusEnum,
} from "./enums";
import { bytea } from "./files";
import { users } from "./identity";

export const crmAccounts = pgTable(
  "crm_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }),
    status: crmAccountStatusEnum("status").notNull().default("lead"),
    linkedUserId: uuid("linked_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("crm_accounts_status_idx").on(table.status),
    index("crm_accounts_created_at_idx").on(table.createdAt),
  ],
);

export const crmNotes = pgTable(
  "crm_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => crmAccounts.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 800 }).notNull(),
    followUpOn: timestamp("follow_up_on", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("crm_notes_account_idx").on(table.accountId),
    index("crm_notes_follow_up_idx").on(table.followUpOn),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subject: varchar("subject", { length: 160 }).notNull(),
    body: varchar("body", { length: 4000 }).notNull(),
    category: supportTicketCategoryEnum("category").notNull().default("other"),
    priority: supportTicketPriorityEnum("priority").notNull().default("normal"),
    status: supportTicketStatusEnum("status").notNull().default("open"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_owner_idx").on(table.ownerUserId),
    index("support_tickets_created_by_idx").on(table.createdByUserId),
  ],
);

export const supportTicketAttachments = pgTable(
  "support_ticket_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("support_ticket_attachments_ticket_idx").on(table.ticketId)],
);

export const crmAccountsRelations = relations(crmAccounts, ({ many }) => ({
  notes: many(crmNotes),
}));

export const crmNotesRelations = relations(crmNotes, ({ one }) => ({
  account: one(crmAccounts, {
    fields: [crmNotes.accountId],
    references: [crmAccounts.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ many }) => ({
  attachments: many(supportTicketAttachments),
}));

export const supportTicketAttachmentsRelations = relations(
  supportTicketAttachments,
  ({ one }) => ({
    ticket: one(supportTickets, {
      fields: [supportTicketAttachments.ticketId],
      references: [supportTickets.id],
    }),
  }),
);
