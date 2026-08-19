import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const contestants = sqliteTable("contestants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantNumber: text("participant_number").notNull(),
  studentId: text("student_id").notNull(),
  category: text("category").notNull(),
  thaiName: text("thai_name").notNull().default(""),
  thaiNickname: text("thai_nickname").notNull().default(""),
  englishName: text("english_name").notNull(),
  englishNickname: text("english_nickname").notNull().default(""),
  department: text("department").notNull().default(""),
  phone: text("phone").notNull().default(""),
  lineId: text("line_id").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  availableDates: text("available_dates").notNull().default(""),
  reviewFlags: text("review_flags").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("contestants_participant_number_unique").on(table.participantNumber),
  uniqueIndex("contestants_student_category_unique").on(table.studentId, table.category),
]);

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  judgeId: integer("judge_id").notNull(),
  participantNumber: text("participant_number").notNull(),
  vocal: integer("vocal").notNull(), diction: integer("diction").notNull(),
  musical: integer("musical").notNull(), expression: integer("expression").notNull(),
  stage: integer("stage").notNull(), lyrics: integer("lyrics").notNull(),
  presentation: integer("presentation").notNull(),
  extraA: integer("extra_a").notNull().default(0), extraB: integer("extra_b").notNull().default(0),
  note: text("note").notNull().default(""), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("judge_participant_unique").on(table.judgeId, table.participantNumber)]);
