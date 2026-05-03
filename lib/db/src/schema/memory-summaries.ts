import {
  pgTable,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const memorySummariesTable = pgTable("memory_summaries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  summary: jsonb("summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemorySummarySchema = createInsertSchema(memorySummariesTable).omit({
  updatedAt: true,
});
export type InsertMemorySummary = z.infer<typeof insertMemorySummarySchema>;
export type MemorySummary = typeof memorySummariesTable.$inferSelect;
