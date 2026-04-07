import { db, usersTable, usageTrackingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { User } from "@workspace/db";

export interface UsageBudgetCheck {
  allowed: boolean;
  reason?: string;
  dailyRemaining: number;
  monthlyTokenRemaining: number;
}

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function checkBudgetForUser(user: User): UsageBudgetCheck {
  const today = getTodayDate();

  let dailyCount = user.dailyMessageCount;
  if (
    !user.dailyMessageResetAt ||
    user.dailyMessageResetAt.toISOString().split("T")[0] < today
  ) {
    dailyCount = 0;
  }

  const dailyRemaining = Math.max(0, user.dailyMessageCap - dailyCount);

  if (dailyRemaining === 0) {
    return {
      allowed: false,
      reason: `Daily message limit of ${user.dailyMessageCap} reached. Your limit resets at midnight.`,
      dailyRemaining: 0,
      monthlyTokenRemaining: Math.max(0, user.monthlyTokenAllowance - user.monthlyTokenCount),
    };
  }

  const thisMonth = today.substring(0, 7);
  let monthlyTokenCount = user.monthlyTokenCount;
  if (
    !user.monthlyTokenResetAt ||
    user.monthlyTokenResetAt.toISOString().substring(0, 7) < thisMonth
  ) {
    monthlyTokenCount = 0;
  }

  const monthlyTokenRemaining = Math.max(0, user.monthlyTokenAllowance - monthlyTokenCount);

  if (monthlyTokenRemaining <= 0) {
    return {
      allowed: false,
      reason: `Monthly token allowance exhausted. Upgrade your plan to continue.`,
      dailyRemaining,
      monthlyTokenRemaining,
    };
  }

  return { allowed: true, dailyRemaining, monthlyTokenRemaining };
}

export async function checkUsageBudget(user: User): Promise<UsageBudgetCheck> {
  return checkBudgetForUser(user);
}

export async function loadFreshBudget(userId: string): Promise<{ user: User; budget: UsageBudgetCheck }> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) throw new Error(`User ${userId} not found`);
  return { user, budget: checkBudgetForUser(user) };
}

export async function recordUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  cacheHitTokens: number,
): Promise<void> {
  const today = getTodayDate();
  const now = new Date();
  const thisMonth = today.substring(0, 7);

  const [existing] = await db
    .select()
    .from(usageTrackingTable)
    .where(
      and(
        eq(usageTrackingTable.userId, userId),
        eq(usageTrackingTable.periodDate, today),
      ),
    );

  if (existing) {
    await db
      .update(usageTrackingTable)
      .set({
        messageCount: existing.messageCount + 1,
        tokenInputCount: existing.tokenInputCount + inputTokens,
        tokenOutputCount: existing.tokenOutputCount + outputTokens,
        tokenCacheHitCount: existing.tokenCacheHitCount + cacheHitTokens,
      })
      .where(eq(usageTrackingTable.id, existing.id));
  } else {
    await db.insert(usageTrackingTable).values({
      id: nanoid(),
      userId,
      periodDate: today,
      messageCount: 1,
      tokenInputCount: inputTokens,
      tokenOutputCount: outputTokens,
      tokenCacheHitCount: cacheHitTokens,
    });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) return;

  const dailyCountNeedsReset =
    !user.dailyMessageResetAt ||
    user.dailyMessageResetAt.toISOString().split("T")[0] < today;

  const monthlyCountNeedsReset =
    !user.monthlyTokenResetAt ||
    user.monthlyTokenResetAt.toISOString().substring(0, 7) < thisMonth;

  await db
    .update(usersTable)
    .set({
      dailyMessageCount: dailyCountNeedsReset ? 1 : user.dailyMessageCount + 1,
      dailyMessageResetAt: dailyCountNeedsReset ? now : user.dailyMessageResetAt,
      monthlyTokenCount: monthlyCountNeedsReset
        ? inputTokens + outputTokens
        : user.monthlyTokenCount + inputTokens + outputTokens,
      monthlyTokenResetAt: monthlyCountNeedsReset ? now : user.monthlyTokenResetAt,
    })
    .where(eq(usersTable.id, userId));
}
