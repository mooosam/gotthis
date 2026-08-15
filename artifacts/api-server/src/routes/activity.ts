import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

type StoredGoalUpdate = {
  goalId?: string;
  goalTitle?: string;
  title?: string;
  note?: string;
  progressNote?: string;
  percentProgress?: number;
  progress?: number;
  status?: string;
  mode?: string;
  actionValue?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  timestamp?: string;
};

function clampProgress(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function describeGoalUpdate(update: StoredGoalUpdate, progress: number | null): string {
  const unit = update.targetUnit?.trim();

  if (update.mode === "reset") {
    return unit && update.targetValue
      ? `Reset to 0. ${update.targetValue} ${unit} remaining.`
      : "Reset today's progress to 0%.";
  }

  if (typeof update.currentValue === "number" && typeof update.targetValue === "number" && unit) {
    const remaining = Math.max(0, update.targetValue - update.currentValue);
    return `${update.currentValue} of ${update.targetValue} ${unit} completed; ${remaining} remaining.`;
  }

  const note = (update.note ?? update.progressNote ?? "").trim();
  if (note) return note;
  if (progress !== null) return `Progress updated to ${progress}%.`;
  return "Progress updated.";
}

/**
 * Returns a user-facing activity stream derived from persisted daily-log facts.
 * The feed never asks AI to invent history; it normalizes the current and legacy
 * goal-update shapes already stored in daily_logs.
 */
router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const limitRaw = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const logs = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, userId))
    .orderBy(desc(dailyLogsTable.updatedAt))
    .limit(limit);

  const activities = logs.flatMap((log) => {
    const data = log.data as Record<string, unknown> | null;
    const goalUpdates = (data?.goalUpdates ?? data?.goalStatuses) as StoredGoalUpdate[] | undefined;
    const items: Array<Record<string, unknown>> = [];
    const narrative = (log.narrative ?? "").trim();
    const fallbackTimestamp =
      typeof data?.midDayTimestamp === "string"
        ? data.midDayTimestamp
        : log.updatedAt ?? log.createdAt;

    if (narrative) {
      items.push({
        id: `${log.id}:checkin`,
        type: "check_in",
        title: "Check-in",
        description: narrative,
        date: log.logDate,
        createdAt: fallbackTimestamp,
      });
    }

    for (const [index, update] of (goalUpdates ?? []).entries()) {
      const progress = clampProgress(update.percentProgress ?? update.progress);
      const status = update.status;
      const type = status === "completed" || progress === 100 ? "milestone_completed" : "goal_update";
      const createdAt = update.timestamp ?? fallbackTimestamp;

      items.push({
        id: `${log.id}:goal:${index}`,
        type,
        title: type === "milestone_completed" ? "Goal completed" : update.mode === "reset" ? "Goal reset" : "Goal updated",
        goalId: update.goalId ?? null,
        goalTitle: update.goalTitle ?? update.title ?? "Goal",
        description: describeGoalUpdate(update, progress),
        progress,
        date: log.logDate,
        createdAt,
      });
    }

    if (!narrative && (!goalUpdates || goalUpdates.length === 0)) {
      items.push({
        id: `${log.id}:activity`,
        type: "check_in",
        title: "Daily check-in",
        description: "Logged activity for the day.",
        date: log.logDate,
        createdAt: fallbackTimestamp,
      });
    }

    return items;
  });

  activities.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
  res.json({ activities: activities.slice(0, 50) });
});

export default router;
