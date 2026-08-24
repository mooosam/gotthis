import { mysqlTable, varchar, text, timestamp, uniqueIndex, index } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

/**
 * Temporary WhatsApp identities for people who message GotThis before creating
 * a Clerk account. The short code is safe to place in WhatsApp; the phone number
 * itself never appears in the URL. A claim is attached to a real user only after
 * that user completes Clerk authentication.
 */
export const pendingWhatsAppClaimsTable = mysqlTable(
  "pending_whatsapp_claims",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    code: varchar("code", { length: 16 }).notNull(),
    phoneHash: text("phone_hash").notNull(),
    whatsappJid: text("whatsapp_jid").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    claimedUserId: varchar("claimed_user_id", { length: 255 }).references(() => usersTable.id, { onDelete: "set null" }),
    claimedAt: timestamp("claimed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("pending_whatsapp_claims_code_unique").on(table.code),
    phoneHashIndex: index("pending_whatsapp_claims_phone_hash_idx").on(table.phoneHash),
  }),
);

export type PendingWhatsAppClaim = typeof pendingWhatsAppClaimsTable.$inferSelect;
