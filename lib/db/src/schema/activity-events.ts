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

export const activityEventsTable = mysqlTable("activity_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  source: varchar("source", { length: 32 }).notNull().default("system"),
  goalId: varchar("goal_id", { length: 255 }).references(() => goalsTable.id, {
    onDelete: "set null",
  }),
  milestoneId: varchar("milestone_id", { length: 255 }).references(() => milestonesTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  progress: int("progress"),
  currentValue: int("current_value"),
  targetValue: int("target_value"),
  targetUnit: text("target_unit"),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  dedupeKey: varchar("dedupe_key", { length: 255 }).unique(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityEvent = typeof activityEventsTable.$inferSelect;
export type InsertActivityEvent = typeof activityEventsTable.$inferInsert;
