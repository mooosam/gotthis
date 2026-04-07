import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { nanoid } from "nanoid";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { status } = req.query as { status?: string };

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
  const { title, description, category, deadline, successCriteria } =
    req.body as {
      title?: string;
      description?: string;
      category?: string;
      deadline?: string;
      successCriteria?: string;
    };

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

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
    })
    .returning();

  res.status(201).json(goal);
});

router.get("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, rawId), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

router.patch("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, description, category, deadline, status, progress, successCriteria } =
    req.body as {
      title?: string;
      description?: string;
      category?: string;
      deadline?: string;
      status?: string;
      progress?: number;
      successCriteria?: string;
    };

  const updates: Partial<typeof goalsTable.$inferSelect> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (deadline !== undefined) updates.deadline = deadline;
  if (status !== undefined) updates.status = status;
  if (progress !== undefined) updates.progress = progress;
  if (successCriteria !== undefined) updates.successCriteria = successCriteria;

  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, rawId), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

router.delete("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [goal] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, rawId), eq(goalsTable.userId, userId)))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
