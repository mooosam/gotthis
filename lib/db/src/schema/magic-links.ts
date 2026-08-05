import {
  mysqlTable,
  text,
  varchar,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const magicLinksTable = mysqlTable("magic_links", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  targetDate: text("target_date"),
  targetGoalId: varchar("target_goal_id", { length: 255 }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinksTable).omit({
  createdAt: true,
});
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type MagicLink = typeof magicLinksTable.$inferSelect;
