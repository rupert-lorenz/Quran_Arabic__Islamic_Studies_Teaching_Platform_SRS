import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cmsDocumentStatusEnum, cmsDocumentTypeEnum } from "./enums";
import { locales } from "./geo";
import { users } from "./identity";

export const cmsDocuments = pgTable(
  "cms_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: cmsDocumentTypeEnum("type").notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    status: cmsDocumentStatusEnum("status").notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(100),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("cms_documents_slug_idx").on(table.slug),
    index("cms_documents_type_status_idx").on(table.type, table.status),
  ],
);

export const cmsDocumentLocales = pgTable(
  "cms_document_locales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => cmsDocuments.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 })
      .notNull()
      .references(() => locales.code, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    excerpt: varchar("excerpt", { length: 400 }),
    body: text("body"),
    seoTitle: varchar("seo_title", { length: 80 }),
    seoDescription: varchar("seo_description", { length: 180 }),
    ctaLabel: varchar("cta_label", { length: 80 }),
    ctaHref: varchar("cta_href", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("cms_document_locales_doc_locale_idx").on(
      table.documentId,
      table.locale,
    ),
  ],
);

export const cmsDocumentsRelations = relations(cmsDocuments, ({ many, one }) => ({
  locales: many(cmsDocumentLocales),
  createdBy: one(users, {
    fields: [cmsDocuments.createdByUserId],
    references: [users.id],
    relationName: "cmsCreatedBy",
  }),
  updatedBy: one(users, {
    fields: [cmsDocuments.updatedByUserId],
    references: [users.id],
    relationName: "cmsUpdatedBy",
  }),
}));

export const cmsDocumentLocalesRelations = relations(
  cmsDocumentLocales,
  ({ one }) => ({
    document: one(cmsDocuments, {
      fields: [cmsDocumentLocales.documentId],
      references: [cmsDocuments.id],
    }),
    localeRecord: one(locales, {
      fields: [cmsDocumentLocales.locale],
      references: [locales.code],
    }),
  }),
);
