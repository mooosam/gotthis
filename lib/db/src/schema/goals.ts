import {
  mysqlTable,
  text,
  varchar,
  int,
  boolean,
  timestamp,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const goalsTable = mysqlTable("goals", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  parentGoalId: varchar("parent_goal_id", { length: 255 }).references((): AnyMySqlColumn => goalsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  deadline: text("deadline"),
  status: text("status").notNull().default("active"),
  cadence: text("cadence").notNull().default("daily"),
  goalType: text("goal_type").notNull().default("habit"),
  targetValue: int("target_value"),
  targetUnit: text("target_unit"),
  currentValue: int("current_value").notNull().default(0),
  progress: int("progress").notNull().default(0),
  successCriteria: text("success_criteria"),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  lastStreakDate: text("last_streak_date"),
  graceUsed: boolean("grace_used").notNull().default(false),
  shareToken: text("share_token"),
  lastProgressResetDate: text("last_progress_reset_date"),
  lastCheckedAt: timestamp("last_checked_at"),
  pausedAt: timestamp("paused_at"),
  pauseReason: text("pause_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
