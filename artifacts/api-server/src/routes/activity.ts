import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, activityEventsTable, dailyLogsTable } from "@workspace/db";
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
    return unit && update.targetValue ? `Reset to 0. ${update.targetValue} ${unit} remaining.` : "Reset today's progress to 0%.";
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

function normalizeEventType(eventType: string): "check_in" | "goal_update" | "milestone_completed" | "goal_created" | "goal_completed" | "goal_archived" | "goal_deleted" | "milestone_created" | "milestone_reopened" | "milestone_edited" | "milestone_deleted" {
  if (eventType === "check_in" || eventType === "morning_check_in" || eventType === "evening_check_in") return "check_in";
  if (eventType === "goal_created") return "goal_created";
  if (eventType === "goal_completed") return "goal_completed";
  if (eventType === "goal_archived") return "goal_archived";
  if (eventType === "goal_deleted") return "goal_deleted";
  if (eventType === "milestone_completed") return "milestone_completed";
  if (eventType === "milestone_created") return "milestone_created";
  if (eventType === "milestone_reopened") return "milestone_reopened";
  if (eventType === "milestone_edited") return "milestone_edited";
  if (eventType === "milestone_deleted") return "milestone_deleted";
  return "goal_update";
}

router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const limitRaw = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const [events, firstEventRows] = await Promise.all([
    db.select().from(activityEventsTable).where(eq(activityEventsTable.userId, userId)).orderBy(desc(activityEventsTable.occurredAt)).limit(limit),
    db.select({ occurredAt: activityEventsTable.occurredAt }).from(activityEventsTable).where(eq(activityEventsTable.userId, userId)).orderBy(asc(activityEventsTable.occurredAt)).limit(1),
  ]);

  const eventItems = events.map((event) => ({
    id: event.id,
    type: normalizeEventType(event.eventType),
    eventType: event.eventType,
    source: event.source,
    title: event.title,
    description: event.description ?? "",
    goalId: event.goalId,
    milestoneId: event.milestoneId,
    goalTitle: typeof event.metadata?.goalTitle === "string" ? event.metadata.goalTitle : null,
    progress: event.progress,
    currentValue: event.currentValue,
    targetValue: event.targetValue,
    targetUnit: event.targetUnit,
    createdAt: event.occurredAt,
    date: event.occurredAt.toISOString().slice(0, 10),
  }));

  // Preserve pre-ledger history from daily_logs, but never mix in legacy rows
  // after the first real event. This creates a clean, duplicate-free cutover.
  const cutoverAt = firstEventRows[0]?.occurredAt ?? null;
  const logs = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, userId))
    .orderBy(desc(dailyLogsTable.updatedAt))
    .limit(50);

  const legacyItems = logs.flatMap((log) => {
    const data = log.data as Record<string, unknown> | null;
    const goalUpdates = (data?.goalUpdates ?? data?.goalStatuses) as StoredGoalUpdate[] | undefined;
    const items: Array<Record<string, unknown>> = [];
    const narrative = (log.narrative ?? "").trim();
    const fallbackTimestamp = typeof data?.midDayTimestamp === "string" ? new Date(data.midDayTimestamp) : (log.updatedAt ?? log.createdAt);

    if (cutoverAt && fallbackTimestamp >= cutoverAt) return items;

    if (narrative) {
      items.push({ id: `legacy:${log.id}:checkin`, type: "check_in", eventType: "legacy_check_in", source: "legacy", title: "Check-in", description: narrative, date: log.logDate, createdAt: fallbackTimestamp });
    }

    for (const [index, update] of (goalUpdates ?? []).entries()) {
      const progress = clampProgress(update.percentProgress ?? update.progress);
      const status = update.status;
      const type = status === "completed" || progress === 100 ? "goal_completed" : "goal_update";
      const createdAt = update.timestamp ? new Date(update.timestamp) : fallbackTimestamp;
      if (cutoverAt && createdAt >= cutoverAt) continue;
      items.push({
        id: `legacy:${log.id}:goal:${index}`,
        type,
        eventType: `legacy_${type}`,
        source: "legacy",
        title: type === "goal_completed" ? "Goal completed" : update.mode === "reset" ? "Goal reset" : "Goal updated",
        goalId: update.goalId ?? null,
        goalTitle: update.goalTitle ?? update.title ?? "Goal",
        description: describeGoalUpdate(update, progress),
        progress,
        currentValue: update.currentValue ?? null,
        targetValue: update.targetValue ?? null,
        targetUnit: update.targetUnit ?? null,
        date: log.logDate,
        createdAt,
      });
    }

    if (!narrative && (!goalUpdates || goalUpdates.length === 0)) {
      items.push({ id: `legacy:${log.id}:activity`, type: "check_in", eventType: "legacy_check_in", source: "legacy", title: "Daily check-in", description: "Logged activity for the day.", date: log.logDate, createdAt: fallbackTimestamp });
    }
    return items;
  });

  const activities = [...eventItems, ...legacyItems]
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, limit);

  res.json({ activities });
});

export default router;
