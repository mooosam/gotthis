import {
  mysqlTable,
  text,
  varchar,
  int,
  timestamp,
  json,
} from "drizzle-orm/mysql-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";
import { milestonesTable } from "./milestones";

export const achievementsTable = mysqlTable("achievements", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  goalId: varchar("goal_id", { length: 255 }).references(() => goalsTable.id, {
    onDelete: "set null",
  }),
  milestoneId: varchar("milestone_id", { length: 255 }).references(() => milestonesTable.id, {
    onDelete: "set null",
  }),
  achievementType: varchar("achievement_type", { length: 64 }).notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  value: int("value"),
  valueLabel: varchar("value_label", { length: 100 }),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  dedupeKey: varchar("dedupe_key", { length: 255 }).notNull().unique(),
  shareToken: varchar("share_token", { length: 64 }).unique(),
  sharedAt: timestamp("shared_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Achievement = typeof achievementsTable.$inferSelect;
export type InsertAchievement = typeof achievementsTable.$inferInsert;
