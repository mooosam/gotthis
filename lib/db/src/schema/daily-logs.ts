import {
  mysqlTable,
  text,
  date,
  json,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dailyLogsTable = mysqlTable(
  "daily_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    data: json("data"),
    narrative: text("narrative"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("daily_logs_user_date_unique").on(t.userId, t.logDate)],
);

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;
