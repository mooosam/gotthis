import {
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const magicLinksTable = pgTable("magic_links", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  targetDate: text("target_date"),
  targetGoalId: text("target_goal_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinksTable).omit({
  createdAt: true,
});
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type MagicLink = typeof magicLinksTable.$inferSelect;
