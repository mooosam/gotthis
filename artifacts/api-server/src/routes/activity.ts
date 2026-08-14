import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

/**
 * Returns a user-facing activity stream derived from the same daily-log data
 * used by check-ins. We intentionally derive the feed from persisted facts
 * rather than asking the AI to invent activity records.
 */
router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const limitRaw = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const logs = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, userId))
    .orderBy(desc(dailyLogsTable.createdAt))
    .limit(limit);

  const activities = logs.flatMap((log) => {
    const data = log.data as Record<string, unknown> | null;
    const goalUpdates = (data?.goalUpdates ?? data?.goalStatuses) as
      | Array<{ goalId?: string; title?: string; note?: string; progressNote?: string; progress?: number; status?: string }>
      | undefined;

    const items: Array<Record<string, unknown>> = [];
    const narrative = (log.narrative ?? "").trim();

    if (narrative) {
      items.push({
        id: `${log.id}:checkin`,
        type: "check_in",
        title: "Check-in",
        description: narrative,
        date: log.logDate,
        createdAt: log.createdAt,
      });
    }

    for (const [index, update] of (goalUpdates ?? []).entries()) {
      const note = (update.note ?? update.progressNote ?? "").trim();
      const status = update.status;
      const type = status === "completed" || update.progress === 100 ? "milestone_completed" : "goal_update";
      items.push({
        id: `${log.id}:goal:${index}`,
        type,
        title: type === "milestone_completed" ? "Completed milestone" : "Goal updated",
        goalId: update.goalId ?? null,
        goalTitle: update.title ?? "Goal",
        description: note || (type === "milestone_completed" ? "Marked complete" : "Progress updated"),
        progress: typeof update.progress === "number" ? Math.max(0, Math.min(100, update.progress)) : null,
        date: log.logDate,
        createdAt: log.createdAt,
      });
    }

    if (!narrative && (!goalUpdates || goalUpdates.length === 0)) {
      items.push({
        id: `${log.id}:activity`,
        type: "check_in",
        title: "Daily check-in",
        description: "Logged activity for the day.",
        date: log.logDate,
        createdAt: log.createdAt,
      });
    }

    return items;
  });

  activities.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ activities: activities.slice(0, 50) });
});

export default router;
