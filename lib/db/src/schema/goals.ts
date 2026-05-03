import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const goalsTable = pgTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  parentGoalId: text("parent_goal_id").references((): AnyPgColumn => goalsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  deadline: text("deadline"),
  status: text("status").notNull().default("active"),
  cadence: text("cadence").notNull().default("daily"),
  goalType: text("goal_type").notNull().default("habit"),
  targetValue: integer("target_value"),
  targetUnit: text("target_unit"),
  currentValue: integer("current_value").notNull().default(0),
  progress: integer("progress").notNull().default(0),
  successCriteria: text("success_criteria"),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastStreakDate: text("last_streak_date"),
  graceUsed: boolean("grace_used").notNull().default(false),
  shareToken: text("share_token"),
  lastProgressResetDate: text("last_progress_reset_date"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  pauseReason: text("pause_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
