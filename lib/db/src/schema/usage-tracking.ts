import {
  mysqlTable,
  text,
  int,
  date,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const usageTrackingTable = mysqlTable(
  "usage_tracking",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    periodDate: date("period_date").notNull(),
    messageCount: int("message_count").notNull().default(0),
    tokenInputCount: int("token_input_count").notNull().default(0),
    tokenOutputCount: int("token_output_count").notNull().default(0),
    tokenCacheHitCount: int("token_cache_hit_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // Hot path: every AI message checks budget via WHERE userId = ? AND periodDate = ?
    index("idx_usage_user_date").on(table.userId, table.periodDate),
  ],
);

export const insertUsageTrackingSchema = createInsertSchema(usageTrackingTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTrackingTable.$inferSelect;
