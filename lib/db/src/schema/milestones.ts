import {
  mysqlTable,
  text,
  varchar,
  int,
  boolean,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { goalsTable } from "./goals";

export const milestonesTable = mysqlTable("milestones", {
  id: varchar("id", { length: 255 }).primaryKey(),
  goalId: varchar("goal_id", { length: 255 })
    .notNull()
    .references(() => goalsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: int("order").notNull().default(1),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;
