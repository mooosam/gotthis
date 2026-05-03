import {
  pgTable,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const usageTrackingTable = pgTable("usage_tracking", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  periodDate: date("period_date").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  tokenInputCount: integer("token_input_count").notNull().default(0),
  tokenOutputCount: integer("token_output_count").notNull().default(0),
  tokenCacheHitCount: integer("token_cache_hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUsageTrackingSchema = createInsertSchema(usageTrackingTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTrackingTable.$inferSelect;
