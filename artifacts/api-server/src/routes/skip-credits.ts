import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, goalsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { UseSkipCreditBody } from "@workspace/api-zod";
import { getDateInTimezone } from "../lib/ai/streaks.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function loadAndResetCredits(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const now = new Date();
  const needsReset =
    !user.skipCreditsResetAt ||
    !isSameMonth(new Date(user.skipCreditsResetAt), now);

  if (needsReset) {
    await db
      .update(usersTable)
      .set({ skipCreditsUsed: 0, skipCreditsResetAt: now })
      .where(eq(usersTable.id, userId));
    return { ...user, skipCreditsUsed: 0, skipCreditsResetAt: now };
  }
  return user;
}

router.get("/skip-credits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const user = await loadAndResetCredits(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    remaining: Math.max(0, user.monthlySkipCredits - user.skipCreditsUsed),
    used: user.skipCreditsUsed,
    monthlyAllowance: user.monthlySkipCredits,
    resetAt: user.skipCreditsResetAt ? user.skipCreditsResetAt.toISOString() : null,
  });
});

router.post("/skip-credits/use", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = UseSkipCreditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Reset before transaction so we don't roll back the monthly reset on a contended update.
  const userPreReset = await loadAndResetCredits(userId);
  if (!userPreReset) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const today = getDateInTimezone(userPreReset.timezone);

  // Atomic check-and-consume using conditional updates with affected-row counts.
  // Both updates run in a single transaction and either succeed together or roll back.
  const result = await db.transaction(async (tx) => {
    // 1. Conditionally claim a credit: only succeeds if user still has credits remaining.
    const creditClaim = await tx
      .update(usersTable)
      .set({ skipCreditsUsed: sql`${usersTable.skipCreditsUsed} + 1` })
      .where(
        and(
          eq(usersTable.id, userId),
          sql`${usersTable.skipCreditsUsed} < ${usersTable.monthlySkipCredits}`,
        ),
      )
      .returning({
        used: usersTable.skipCreditsUsed,
        monthly: usersTable.monthlySkipCredits,
      });

    if (creditClaim.length === 0) {
      return { kind: "no_credits" as const };
    }

    // 2. Conditionally stamp the goal's streak: only succeeds if the goal is owned by user,
    //    is a daily habit, and hasn't been stamped today already.
    const stamp = await tx
      .update(goalsTable)
      .set({ lastStreakDate: today, graceUsed: false })
      .where(
        and(
          eq(goalsTable.id, parsed.data.goalId),
          eq(goalsTable.userId, userId),
          eq(goalsTable.goalType, "habit"),
          eq(goalsTable.cadence, "daily"),
          sql`(${goalsTable.lastStreakDate} IS NULL OR ${goalsTable.lastStreakDate} <> ${today})`,
        ),
      )
      .returning({ id: goalsTable.id });

    if (stamp.length === 0) {
      // Goal not eligible — roll back the credit claim by throwing.
      throw new SkipNotEligibleError();
    }

    const claimed = creditClaim[0]!;
    return {
      kind: "ok" as const,
      remaining: Math.max(0, claimed.monthly - claimed.used),
    };
  }).catch((err) => {
    if (err instanceof SkipNotEligibleError) {
      return { kind: "ineligible" as const };
    }
    throw err;
  });

  if (result.kind === "no_credits") {
    res.status(400).json({ error: "No skip credits remaining this month" });
    return;
  }

  if (result.kind === "ineligible") {
    res
      .status(400)
      .json({ error: "Goal not found, not a daily habit, or streak already preserved today" });
    return;
  }

  logger.info(
    { userId, goalId: parsed.data.goalId, remaining: result.remaining },
    "Skip credit used to preserve streak",
  );

  res.json({
    success: true,
    remaining: result.remaining,
    goalId: parsed.data.goalId,
  });
});

class SkipNotEligibleError extends Error {
  constructor() {
    super("Skip not eligible");
    this.name = "SkipNotEligibleError";
  }
}

export default router;
