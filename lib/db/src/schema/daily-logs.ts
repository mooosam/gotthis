import {
  pgTable,
  text,
  date,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyLogsTable = pgTable("daily_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  logDate: date("log_date").notNull(),
  data: jsonb("data"),
  narrative: text("narrative"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;
