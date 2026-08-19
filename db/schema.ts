import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  judgeId: integer("judge_id").notNull(),
  participantNumber: text("participant_number").notNull(),
  vocal: integer("vocal").notNull(), diction: integer("diction").notNull(),
  musical: integer("musical").notNull(), expression: integer("expression").notNull(),
  stage: integer("stage").notNull(), lyrics: integer("lyrics").notNull(),
  presentation: integer("presentation").notNull(),
  note: text("note").notNull().default(""), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("judge_participant_unique").on(table.judgeId, table.participantNumber)]);
