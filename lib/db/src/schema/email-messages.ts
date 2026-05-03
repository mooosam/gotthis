import {
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const emailMessagesTable = pgTable("email_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull().unique(),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmailMessageSchema = createInsertSchema(emailMessagesTable).omit({
  createdAt: true,
});
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessagesTable.$inferSelect;
