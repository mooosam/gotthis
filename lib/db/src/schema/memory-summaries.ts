import {
  mysqlTable,
  text,
  varchar,
  json,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const memorySummariesTable = mysqlTable("memory_summaries", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  summary: json("summary"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemorySummarySchema = createInsertSchema(memorySummariesTable).omit({
  updatedAt: true,
});
export type InsertMemorySummary = z.infer<typeof insertMemorySummarySchema>;
export type MemorySummary = typeof memorySummariesTable.$inferSelect;
