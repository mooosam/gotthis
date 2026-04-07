import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, goalsTable, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get(
  "/dashboard/stats",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const [goalCounts] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId));

    const [activeCount] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId));

    const [completedCount] = await db
      .select({ total: count() })
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId));

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

    const topGoals = await db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(desc(goalsTable.currentStreak))
      .limit(5);

    const totalGoals = goalCounts?.total ?? 0;
    const activeGoals = activeCount?.total ?? 0;
    const completedGoals = completedCount?.total ?? 0;
    const totalLogs = logCount?.total ?? 0;
    const currentStreak =
      topGoals.length > 0 ? topGoals[0].currentStreak : 0;
    const weeklyCompletionRate = totalLogs > 0 ? Math.min(recentLogs.length / 7, 1) : 0;

    res.json({
      totalGoals,
      activeGoals,
      completedGoals,
      totalLogs,
      currentStreak,
      weeklyCompletionRate,
      recentLogs,
      topGoals,
    });
  },
);

export default router;
