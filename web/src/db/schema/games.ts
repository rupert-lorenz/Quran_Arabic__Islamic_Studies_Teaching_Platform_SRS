import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./catalog";
import {
  educationalGameKindEnum,
  teachingMaterialStatusEnum,
} from "./enums";
import { users } from "./identity";
import { studentProfiles } from "./profiles";
import type { EducationalGamePayload } from "@/lib/games";

export const educationalGames = pgTable(
  "educational_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    instructions: varchar("instructions", { length: 400 }),
    subjectSlug: varchar("subject_slug", { length: 40 }).references(
      () => subjects.slug,
      { onDelete: "set null" },
    ),
    kind: educationalGameKindEnum("kind").notNull(),
    status: teachingMaterialStatusEnum("status").notNull().default("draft"),
    payload: jsonb("payload")
      .$type<EducationalGamePayload>()
      .notNull(),
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
    index("educational_games_created_by_idx").on(table.createdByUserId),
    index("educational_games_status_idx").on(table.status),
    index("educational_games_kind_idx").on(table.kind),
  ],
);

export const educationalGamePlays = pgTable(
  "educational_game_plays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => educationalGames.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("educational_game_plays_game_idx").on(table.gameId),
    index("educational_game_plays_student_idx").on(table.studentUserId),
  ],
);

export const educationalGamesRelations = relations(
  educationalGames,
  ({ many }) => ({
    plays: many(educationalGamePlays),
  }),
);

export const educationalGamePlaysRelations = relations(
  educationalGamePlays,
  ({ one }) => ({
    game: one(educationalGames, {
      fields: [educationalGamePlays.gameId],
      references: [educationalGames.id],
    }),
    student: one(studentProfiles, {
      fields: [educationalGamePlays.studentUserId],
      references: [studentProfiles.userId],
    }),
  }),
);
