import type { Request, Response, NextFunction } from "express";
import { eq, count, and, ne } from "drizzle-orm";
import { db, usersTable, goalsTable } from "@workspace/db";
import { getTierConfig } from "../lib/tierConfig";

type AuthedRequest = Request & { userId: string };

export function requireEmailChannel() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const cfg = getTierConfig(user.tier);
    if (!cfg.emailChannel) {
      res.status(402).json({
        error: "Email channel requires Pro or Elite",
        code: "TIER_GATE",
        gate: "email_channel",
        upgradeRequired: "pro",
        message: "Upgrade to Pro to access email coaching — $12/mo or $99/yr",
        checkoutPath: "/account#billing",
      });
      return;
    }
    next();
  };
}

export function requireProactiveNudges() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const cfg = getTierConfig(user.tier);
    if (!cfg.proactiveNudges) {
      res.status(402).json({
        error: "Proactive nudges require Elite",
        code: "TIER_GATE",
        gate: "proactive_nudges",
        upgradeRequired: "elite",
        message: "Upgrade to Elite to unlock proactive nudges — $29/mo",
        checkoutPath: "/account#billing",
      });
      return;
    }
    next();
  };
}

export function requireGoalSlot() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const cfg = getTierConfig(user.tier);
    if (cfg.goalCountLimit === 0) { next(); return; }

    const [{ value: goalCount }] = await db
      .select({ value: count() })
      .from(goalsTable)
      .where(
        and(
          eq(goalsTable.userId, userId),
          ne(goalsTable.status, "archived"),
          ne(goalsTable.status, "completed"),
        )
      );

    if (goalCount >= cfg.goalCountLimit) {
      res.status(402).json({
        error: `Goal limit reached (${cfg.goalCountLimit} on ${cfg.label} plan)`,
        code: "TIER_GATE",
        gate: "goal_count",
        limit: cfg.goalCountLimit,
        current: goalCount,
        upgradeRequired: user.tier === "free" ? "pro" : "elite",
        message:
          user.tier === "free"
            ? `Free plan allows ${cfg.goalCountLimit} goals. Upgrade to Pro for up to 10 — $12/mo`
            : `Pro plan allows ${cfg.goalCountLimit} goals. Upgrade to Elite for unlimited goals — $29/mo`,
        checkoutPath: "/account#billing",
      });
      return;
    }
    next();
  };
}
