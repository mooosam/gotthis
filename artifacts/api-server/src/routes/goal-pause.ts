import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { PauseGoalBody } from "@workspace/api-zod";
import { recordActivityEvent } from "../lib/activity-events.js";

const router: IRouter = Router();

router.post("/goals/:id/pause", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = req.params["id"] as string;
  const parsed = PauseGoalBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.update(goalsTable).set({ pausedAt: new Date(), pauseReason: parsed.data.reason ?? null }).where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  await recordActivityEvent({
    userId,
    eventType: "goal_paused",
    source: "dashboard",
    goalId: goal.id,
    title: "Goal paused",
    description: parsed.data.reason ? `${goal.title} · ${parsed.data.reason}` : goal.title,
    progress: goal.progress,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
  });
  res.json(goal);
});

router.post("/goals/:id/resume", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = req.params["id"] as string;
  await db.update(goalsTable).set({ pausedAt: null, pauseReason: null }).where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  await recordActivityEvent({
    userId,
    eventType: "goal_resumed",
    source: "dashboard",
    goalId: goal.id,
    title: "Goal resumed",
    description: goal.title,
    progress: goal.progress,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
  });
  res.json(goal);
});

export default router;
