import { mysqlTable, varchar, text, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

/**
 * Short-lived, single-use links issued from trusted channels such as WhatsApp.
 * The short code itself never contains a Clerk credential. A Clerk sign-in token
 * is minted only when the link is redeemed.
 */
export const shortAuthLinksTable = mysqlTable(
  "short_auth_links",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    code: varchar("code", { length: 16 }).notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("short_auth_links_code_unique").on(table.code),
  }),
);

export type ShortAuthLink = typeof shortAuthLinksTable.$inferSelect;
