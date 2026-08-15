import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, milestonesTable, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { recordActivityEvent } from "../lib/activity-events.js";
import { nanoid } from "nanoid";

const router: IRouter = Router();

router.get("/goals/:goalId/milestones", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const goalId = req.params["goalId"] as string;
  const [goal] = await db.select({ id: goalsTable.id }).from(goalsTable).where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }
  const milestones = await db.select().from(milestonesTable).where(and(eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId))).orderBy(asc(milestonesTable.order));
  res.json(milestones);
});

router.post("/goals/:goalId/milestones", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const goalId = req.params["goalId"] as string;
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  const { title, order } = req.body as { title?: string; order?: number };
  if (!title || typeof title !== "string" || title.trim().length === 0) { res.status(400).json({ error: "title is required" }); return; }
  const existing = await db.select({ order: milestonesTable.order }).from(milestonesTable).where(and(eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId))).orderBy(asc(milestonesTable.order));
  const nextOrder = typeof order === "number" && order >= 1 ? order : (existing.length > 0 ? Math.max(...existing.map((m) => m.order)) + 1 : 1);

  const milestoneId = nanoid();
  await db.insert(milestonesTable).values({ id: milestoneId, goalId, userId, title: title.trim(), order: nextOrder });
  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestoneId));

  await recordActivityEvent({
    userId,
    eventType: "milestone_created",
    source: "dashboard",
    goalId,
    milestoneId,
    title: "Milestone created",
    description: `${milestone.title} · ${goal.title}`,
    progress: goal.progress,
  });
  res.status(201).json(milestone);
});

router.patch("/goals/:goalId/milestones/:milestoneId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const goalId = req.params["goalId"] as string;
  const milestoneId = req.params["milestoneId"] as string;

  const [before] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId)));
  if (!before) { res.status(404).json({ error: "Milestone not found" }); return; }
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

  const body = req.body as { title?: string; order?: number; completed?: boolean };
  const updates: Partial<typeof milestonesTable.$inferInsert> = {};
  if (typeof body.title === "string" && body.title.trim().length > 0) updates.title = body.title.trim();
  if (typeof body.order === "number" && body.order >= 1) updates.order = body.order;
  if (typeof body.completed === "boolean") {
    updates.completed = body.completed;
    updates.completedAt = body.completed ? new Date() : null;
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  await db.update(milestonesTable).set(updates).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId)));
  const [milestone] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId)));
  if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }

  const completionChanged = milestone.completed !== before.completed;
  const eventType = completionChanged ? (milestone.completed ? "milestone_completed" : "milestone_reopened") : "milestone_edited";
  await recordActivityEvent({
    userId,
    eventType,
    source: "dashboard",
    goalId,
    milestoneId,
    title: milestone.completed && completionChanged ? "Milestone completed" : completionChanged ? "Milestone reopened" : "Milestone edited",
    description: `${milestone.title}${goal ? ` · ${goal.title}` : ""}`,
    progress: goal?.progress ?? null,
    metadata: { changedFields: Object.keys(updates) },
  });

  res.json(milestone);
});

router.delete("/goals/:goalId/milestones/:milestoneId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const goalId = req.params["goalId"] as string;
  const milestoneId = req.params["milestoneId"] as string;
  const [milestone] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId)));
  if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

  await recordActivityEvent({
    userId,
    eventType: "milestone_deleted",
    source: "dashboard",
    goalId,
    milestoneId,
    title: "Milestone deleted",
    description: `${milestone.title}${goal ? ` · ${goal.title}` : ""}`,
    progress: goal?.progress ?? null,
  });
  await db.delete(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.goalId, goalId), eq(milestonesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
