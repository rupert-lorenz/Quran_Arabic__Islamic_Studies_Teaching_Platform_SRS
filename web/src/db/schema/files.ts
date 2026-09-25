import { relations } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { filePurposeEnum, fileVisibilityEnum } from "./enums";
import { users } from "./identity";

export const bytea = customType<{ data: Buffer; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    purpose: filePurposeEnum("purpose").notNull().default("other"),
    storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull().default(0),
    originalName: varchar("original_name", { length: 255 }),
    visibility: fileVisibilityEnum("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("files_owner_user_id_idx").on(table.ownerUserId),
    index("files_purpose_idx").on(table.purpose),
  ],
);

export const fileObjects = pgTable("file_objects", {
  fileId: uuid("file_id")
    .primaryKey()
    .references(() => files.id, { onDelete: "cascade" }),
  content: bytea("content").notNull(),
});

export const filesRelations = relations(files, ({ one }) => ({
  owner: one(users, {
    fields: [files.ownerUserId],
    references: [users.id],
  }),
  object: one(fileObjects, {
    fields: [files.id],
    references: [fileObjects.fileId],
  }),
}));

export const fileObjectsRelations = relations(fileObjects, ({ one }) => ({
  file: one(files, {
    fields: [fileObjects.fileId],
    references: [files.id],
  }),
}));
