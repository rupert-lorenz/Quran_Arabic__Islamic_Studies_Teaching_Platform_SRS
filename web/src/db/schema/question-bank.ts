import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import {
  quizQuestionKindEnum,
  teachingMaterialStatusEnum,
} from "./enums";
import { users } from "./identity";
import type { QuestionBankBody } from "@/lib/question-bank";

export const questionBankItems = pgTable(
  "question_bank_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    prompt: varchar("prompt", { length: 400 }).notNull(),
    kind: quizQuestionKindEnum("kind").notNull(),
    topic: varchar("topic", { length: 80 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    body: jsonb("body").$type<QuestionBankBody>().notNull(),
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
    index("question_bank_items_created_by_idx").on(table.createdByUserId),
    index("question_bank_items_status_idx").on(table.status),
    index("question_bank_items_kind_idx").on(table.kind),
    index("question_bank_items_subject_idx").on(table.subjectSlug),
  ],
);

export const questionBankItemsRelations = relations(
  questionBankItems,
  ({ one }) => ({
    author: one(users, {
      fields: [questionBankItems.createdByUserId],
      references: [users.id],
    }),
  }),
);
