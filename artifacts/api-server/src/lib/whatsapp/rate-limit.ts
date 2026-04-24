import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function checkWhatsAppRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const [user] = await db
    .select({
      dailyMessageCount: usersTable.dailyMessageCount,
      dailyMessageResetAt: usersTable.dailyMessageResetAt,
      dailyMessageCap: usersTable.dailyMessageCap,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return { allowed: false, reason: "User not found." };

  const today = new Date().toISOString().split("T")[0];
  const resetDate = user.dailyMessageResetAt?.toISOString().split("T")[0];

  const effectiveCount = resetDate === today ? user.dailyMessageCount : 0;
  const cap = user.dailyMessageCap ?? 5;

  if (effectiveCount >= cap) {
    return {
      allowed: false,
      reason: `Daily message limit of ${cap} reached. Your limit resets at midnight.`,
    };
  }

  return { allowed: true };
}
