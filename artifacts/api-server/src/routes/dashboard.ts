import { Router, type IRouter } from "express";
import { eq, and, count, desc, gte } from "drizzle-orm";
import { db, goalsTable, dailyLogsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get(
  "/dashboard/stats",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const [user] = await db
      .select({ timezone: usersTable.timezone })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const [goalCounts] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId));

    const [activeCount] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

    const [completedCount] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "completed")));

    const [logCount] = await db
      .select({ total: count() })
      .from(dailyLogsTable)
      .where(eq(dailyLogsTable.userId, userId));

    const recentLogs = await db
      .select()
      .from(dailyLogsTable)
      .where(eq(dailyLogsTable.userId, userId))
      .orderBy(desc(dailyLogsTable.logDate))
      .limit(7);

    // Weekly completion must use the current seven-day window, not simply the
    // seven most recent logs, which could include much older history.
    const weeklyStart = new Date();
    weeklyStart.setHours(0, 0, 0, 0);
    weeklyStart.setDate(weeklyStart.getDate() - 6);
    const weeklyStartDate = weeklyStart.toISOString().split("T")[0];
    const weeklyLogs = await db
      .select({ logDate: dailyLogsTable.logDate })
      .from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.userId, userId), gte(dailyLogsTable.logDate, weeklyStartDate)));

    const dailyLogNotes = await db
      .select()
      .from(dailyLogsTable)
      .where(eq(dailyLogsTable.userId, userId))
      .orderBy(desc(dailyLogsTable.logDate));

    const topGoals = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(desc(goalsTable.currentStreak))
      .limit(5);

    const goalNotes = new Map<string, string[]>();
    for (const log of dailyLogNotes) {
      const data = log.data as Record<string, unknown> | null;
      const goalUpdates = (data?.goalUpdates ?? data?.goalStatuses) as
        | Array<{ goalId?: string; title?: string; note?: string; progressNote?: string }>
        | undefined;
      if (!goalUpdates) continue;

      for (const update of goalUpdates) {
        const goalId = update.goalId;
        const note = (update.note ?? update.progressNote ?? "").trim();
        if (!goalId || !note) continue;
        const existing = goalNotes.get(goalId) ?? [];
        if (!existing.includes(note)) {
          existing.push(note);
          goalNotes.set(goalId, existing);
        }
      }
    }

    const totalGoals = goalCounts?.total ?? 0;
    const activeGoals = activeCount?.total ?? 0;
    const completedGoals = completedCount?.total ?? 0;
    const totalLogs = logCount?.total ?? 0;
    const currentStreak = topGoals.length > 0 ? topGoals[0].currentStreak : 0;
    const weeklyCompletionRate = Math.min(weeklyLogs.length / 7, 1);

    res.json({
      totalGoals,
      activeGoals,
      completedGoals,
      totalLogs,
      currentStreak,
      weeklyCompletionRate,
      recentLogs,
      topGoals,
      goalNotes: Object.fromEntries(goalNotes),
      timezone: user?.timezone ?? "UTC",
    });
  },
);

export default router;
