import { db, usersTable, usageTrackingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { User } from "@workspace/db";
import { logger } from "../logger.js";
import { isGrowthMode } from "../growth-mode.js";

export function getCacheHitTokens(_usage?: object): number { return 0; }

export interface UsageBudgetCheck {
  allowed: boolean;
  reason?: string;
  upgradePrompt?: {
    code: "TIER_GATE";
    gate: "daily_cap" | "monthly_tokens";
    upgradeRequired: "pro" | "elite";
    message: string;
  };
  dailyRemaining: number;
  monthlyTokenRemaining: number;
}

export function getTodayDate(): string { return new Date().toISOString().split("T")[0]; }

export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().split("T")[0];
  }
}

export function checkBudgetForUser(user: User): UsageBudgetCheck {
  const tz = user.timezone || "UTC";
  const now = new Date();
  const todayLocal = formatDateInTimezone(now, tz);
  const thisMonthLocal = todayLocal.substring(0, 7);
  const lastDailyResetLocal = user.dailyMessageResetAt ? formatDateInTimezone(user.dailyMessageResetAt, tz) : null;
  const dailyNeedsReset = !lastDailyResetLocal || lastDailyResetLocal < todayLocal;
  const dailyCount = dailyNeedsReset ? 0 : user.dailyMessageCount;
  const dailyRemaining = Math.max(0, user.dailyMessageCap - dailyCount);
  const lastMonthlyResetLocal = user.monthlyTokenResetAt ? formatDateInTimezone(user.monthlyTokenResetAt, tz).substring(0, 7) : null;
  const monthlyNeedsReset = !lastMonthlyResetLocal || lastMonthlyResetLocal < thisMonthLocal;
  const monthlyTokenCount = monthlyNeedsReset ? 0 : user.monthlyTokenCount;
  const monthlyTokenRemaining = Math.max(0, user.monthlyTokenAllowance - monthlyTokenCount);

  // During acquisition, commercial limits are dormant but counters continue
  // recording real usage so future paid tiers can be based on observed costs.
  if (isGrowthMode()) {
    return { allowed: true, dailyRemaining, monthlyTokenRemaining };
  }

  if (dailyRemaining === 0) {
    logger.info({ userId: user.id, event: "daily_cap_reached", cap: user.dailyMessageCap, timezone: tz }, "Daily message cap reached");
    const isFree = user.tier === "free" || !user.tier;
    return {
      allowed: false,
      reason: isFree ? `You've used all ${user.dailyMessageCap} messages for today (Free plan). Upgrade to Pro for 50 messages/day — or your limit resets at midnight.` : `Daily message limit of ${user.dailyMessageCap} reached. Your limit resets at midnight.`,
      upgradePrompt: isFree ? { code: "TIER_GATE", gate: "daily_cap", upgradeRequired: "pro", message: "Upgrade to Pro for 50 messages/day — $12/mo or $99/yr" } : undefined,
      dailyRemaining: 0,
      monthlyTokenRemaining,
    };
  }

  if (monthlyTokenRemaining <= 0) {
    logger.info({ userId: user.id, event: "monthly_token_exhausted", allowance: user.monthlyTokenAllowance }, "Monthly token allowance exhausted");
    const isFree = user.tier === "free" || !user.tier;
    const isPro = user.tier === "pro";
    return {
      allowed: false,
      reason: isFree ? "Monthly token allowance exhausted. Upgrade to Pro ($12/mo) for 10× more tokens." : isPro ? "Monthly token allowance exhausted. Upgrade to Elite ($29/mo) for unlimited tokens." : "Monthly token allowance exhausted.",
      upgradePrompt: isFree ? { code: "TIER_GATE", gate: "monthly_tokens", upgradeRequired: "pro", message: "Upgrade to Pro for 500K tokens/month — $12/mo" } : isPro ? { code: "TIER_GATE", gate: "monthly_tokens", upgradeRequired: "elite", message: "Upgrade to Elite for 2M tokens/month — $29/mo" } : undefined,
      dailyRemaining,
      monthlyTokenRemaining,
    };
  }
  return { allowed: true, dailyRemaining, monthlyTokenRemaining };
}

export async function checkUsageBudget(user: User): Promise<UsageBudgetCheck> { return checkBudgetForUser(user); }

export async function loadFreshBudget(userId: string): Promise<{ user: User; budget: UsageBudgetCheck }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new Error(`User ${userId} not found`);
  return { user, budget: checkBudgetForUser(user) };
}

export async function recordUsage(userId: string, inputTokens: number, outputTokens: number, cacheHitTokens: number): Promise<void> {
  const today = getTodayDate();
  const now = new Date();
  const [existing] = await db.select().from(usageTrackingTable).where(and(eq(usageTrackingTable.userId, userId), eq(usageTrackingTable.periodDate, today)));
  if (existing) {
    await db.update(usageTrackingTable).set({
      messageCount: existing.messageCount + 1,
      tokenInputCount: existing.tokenInputCount + inputTokens,
      tokenOutputCount: existing.tokenOutputCount + outputTokens,
      tokenCacheHitCount: existing.tokenCacheHitCount + cacheHitTokens,
    }).where(eq(usageTrackingTable.id, existing.id));
  } else {
    await db.insert(usageTrackingTable).values({ id: nanoid(), userId, periodDate: today, messageCount: 1, tokenInputCount: inputTokens, tokenOutputCount: outputTokens, tokenCacheHitCount: cacheHitTokens });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return;
  const tz = user.timezone || "UTC";
  const todayLocal = formatDateInTimezone(now, tz);
  const thisMonthLocal = todayLocal.substring(0, 7);
  const dailyCountNeedsReset = !user.dailyMessageResetAt || formatDateInTimezone(user.dailyMessageResetAt, tz) < todayLocal;
  const monthlyCountNeedsReset = !user.monthlyTokenResetAt || formatDateInTimezone(user.monthlyTokenResetAt, tz).substring(0, 7) < thisMonthLocal;
  if (dailyCountNeedsReset) logger.info({ userId, event: "daily_counter_reset", timezone: tz }, "Daily message counter reset");
  if (monthlyCountNeedsReset) logger.info({ userId, event: "monthly_counter_reset", timezone: tz }, "Monthly token counter reset");
  await db.update(usersTable).set({
    dailyMessageCount: dailyCountNeedsReset ? 1 : user.dailyMessageCount + 1,
    dailyMessageResetAt: dailyCountNeedsReset ? now : user.dailyMessageResetAt,
    monthlyTokenCount: monthlyCountNeedsReset ? inputTokens + outputTokens : user.monthlyTokenCount + inputTokens + outputTokens,
    monthlyTokenResetAt: monthlyCountNeedsReset ? now : user.monthlyTokenResetAt,
  }).where(eq(usersTable.id, userId));
}
