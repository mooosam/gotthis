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

  const {
    title,
    description,
    category,
    deadline,
    successCriteria,
    cadence,
    goalType,
    targetValue,
    targetUnit,
  } = parsed.data;

  const resolvedType = goalType ?? "habit";
  // Quantitative types accumulate over time; force ongoing cadence
  const resolvedCadence =
    resolvedType === "target" || resolvedType === "average" || resolvedType === "milestone"
      ? "ongoing"
      : (cadence ?? "daily");

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
      cadence: resolvedCadence,
      goalType: resolvedType,
      targetValue: targetValue ?? null,
      targetUnit: targetUnit ?? null,
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

  const {
    title,
    description,
    category,
    deadline,
    status,
    progress,
    successCriteria,
    cadence,
    goalType,
    targetValue,
    targetUnit,
    currentValue,
  } = bodyParsed.data;

  // Load existing goal first so we can resolve effective fields when only a subset is patched.
  const [existing] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, paramsParsed.data.id), eq(goalsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const updates: Partial<typeof goalsTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (deadline !== undefined) updates.deadline = deadline;
  if (status !== undefined) updates.status = status;
  if (successCriteria !== undefined) updates.successCriteria = successCriteria;
  if (goalType !== undefined) updates.goalType = goalType;
  if (targetValue !== undefined) updates.targetValue = targetValue;
  if (targetUnit !== undefined) updates.targetUnit = targetUnit;
  if (currentValue !== undefined) updates.currentValue = currentValue;

  // Resolve effective values to enforce invariants and derive progress consistently.
  const effectiveType = goalType ?? existing.goalType;
  const effectiveTarget = targetValue !== undefined ? targetValue : existing.targetValue;
  const effectiveCurrent = currentValue !== undefined ? currentValue : existing.currentValue;
  const isQuant = effectiveType === "target" || effectiveType === "average";
  const isMilestoneOrQuant = isQuant || effectiveType === "milestone";

  // Type/cadence invariant: non-habit types are always 'ongoing' (no daily reset / streaks).
  if (cadence !== undefined) {
    updates.cadence = isMilestoneOrQuant ? "ongoing" : cadence;
  } else if (goalType !== undefined && isMilestoneOrQuant && existing.cadence !== "ongoing") {
    updates.cadence = "ongoing";
  }

  if (isQuant && effectiveTarget && effectiveTarget > 0) {
    // Auto-derive progress for quantitative types from effective current/target.
    updates.progress = Math.min(100, Math.round((effectiveCurrent / effectiveTarget) * 100));
  } else if (progress !== undefined) {
    // Manual progress only honored for non-quantitative types.
    updates.progress = progress;
  }

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
