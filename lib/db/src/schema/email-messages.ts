import {
  mysqlTable,
  text,
  varchar,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const emailMessagesTable = mysqlTable("email_messages", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  messageId: varchar("message_id", { length: 255 }).notNull().unique(),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailMessageSchema = createInsertSchema(emailMessagesTable).omit({
  createdAt: true,
});
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailMessage = typeof emailMessagesTable.$inferSelect;
