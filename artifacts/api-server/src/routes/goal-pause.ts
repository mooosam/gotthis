import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { PauseGoalBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/goals/:id/pause", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = req.params["id"] as string;

  const parsed = PauseGoalBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // MySQL: no .returning() — update then re-select
  await db
    .update(goalsTable)
    .set({
      pausedAt: new Date(),
      pauseReason: parsed.data.reason ?? null,
    })
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

router.post("/goals/:id/resume", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = req.params["id"] as string;

  // MySQL: no .returning() — update then re-select
  await db
    .update(goalsTable)
    .set({
      pausedAt: null,
      pauseReason: null,
    })
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

export default router;
