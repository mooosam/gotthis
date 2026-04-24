import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const WHATSAPP_DAILY_LIMIT = 20;

export async function checkWhatsAppRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const [user] = await db
    .select({
      dailyMessageCount: usersTable.dailyMessageCount,
      dailyMessageResetAt: usersTable.dailyMessageResetAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return { allowed: false, reason: "User not found." };

  const today = new Date().toISOString().split("T")[0];
  const resetDate = user.dailyMessageResetAt?.toISOString().split("T")[0];

  const effectiveCount = resetDate === today ? user.dailyMessageCount : 0;

  if (effectiveCount >= WHATSAPP_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `You have reached the daily limit of ${WHATSAPP_DAILY_LIMIT} messages. Your limit resets at midnight.`,
    };
  }

  return { allowed: true };
}
