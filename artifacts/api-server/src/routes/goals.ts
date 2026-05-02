import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { nanoid } from "nanoid";
import {
  CreateGoalBody,
  ListGoalsQueryParams,
  UpdateGoalBody,
  GetGoalParams,
  UpdateGoalParams,
  DeleteGoalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = ListGoalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status } = parsed.data;
  const conditions = [eq(goalsTable.userId, userId)];
  if (status) conditions.push(eq(goalsTable.status, status));

  const goals = await db
    .select()
    .from(goalsTable)
    .where(and(...conditions))
    .orderBy(goalsTable.createdAt);

  res.json(goals);
});

router.post("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, description, category, deadline, successCriteria, cadence } = parsed.data;

  const [goal] = await db
    .insert(goalsTable)
    .values({
      id: nanoid(),
      userId,
      title,
      description: description ?? null,
      category: category ?? "general",
      deadline: deadline ?? null,
      successCriteria: successCriteria ?? null,
      cadence: cadence ?? "daily",
      shareToken: nanoid(16),
    })
    .returning();

  res.status(201).json(goal);
});

router.get("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = GetGoalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

router.patch("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const paramsParsed = UpdateGoalParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = UpdateGoalBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { title, description, category, deadline, status, progress, successCriteria, cadence } = bodyParsed.data;

  const updates: Partial<typeof goalsTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (deadline !== undefined) updates.deadline = deadline;
  if (status !== undefined) updates.status = status;
  if (progress !== undefined) updates.progress = progress;
  if (successCriteria !== undefined) updates.successCriteria = successCriteria;
  if (cadence !== undefined) updates.cadence = cadence;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, paramsParsed.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

router.delete("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = DeleteGoalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [goal] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
