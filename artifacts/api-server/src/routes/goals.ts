import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGoalSlot } from "../middlewares/requireTier";
import { recordActivityEvent } from "../lib/activity-events.js";
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
const SUPPORTED_CADENCES = new Set(["daily", "weekly", "monthly", "one_time", "ongoing"]);

function readCadence(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>).cadence;
  if (value === undefined) return undefined;
  return typeof value === "string" && SUPPORTED_CADENCES.has(value) ? value : "__invalid__";
}

function bodyForLegacyGeneratedValidator(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const raw = body as Record<string, unknown>;
  if (["weekly", "monthly", "one_time"].includes(String(raw.cadence ?? ""))) {
    return { ...raw, cadence: "ongoing" };
  }
  return body;
}

async function validateParent(
  userId: string,
  parentGoalId: string,
  selfId: string | null,
): Promise<string | null> {
  if (selfId !== null && parentGoalId === selfId) return "A goal cannot be its own parent";
  const seen = new Set<string>();
  let cursor: string | null = parentGoalId;
  while (cursor) {
    if (seen.has(cursor)) return "Cycle detected in parent chain";
    seen.add(cursor);
    if (selfId !== null && cursor === selfId) return "Setting this parent would create a cycle";
    const [parent] = await db
      .select({ id: goalsTable.id, parentGoalId: goalsTable.parentGoalId })
      .from(goalsTable)
      .where(and(eq(goalsTable.id, cursor), eq(goalsTable.userId, userId)));
    if (!parent) return "Parent goal not found";
    cursor = parent.parentGoalId;
  }
  return null;
}

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = ListGoalsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { status } = parsed.data;
  const conditions = [eq(goalsTable.userId, userId)];
  if (status) conditions.push(eq(goalsTable.status, status));
  const goals = await db.select().from(goalsTable).where(and(...conditions)).orderBy(goalsTable.createdAt);
  res.json(goals);
});

router.post("/goals", requireAuth, requireGoalSlot(), async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const requestedCadence = readCadence(req.body);
  if (requestedCadence === "__invalid__") { res.status(400).json({ error: "cadence must be daily, weekly, monthly, one_time, or ongoing" }); return; }
  const parsed = CreateGoalBody.safeParse(bodyForLegacyGeneratedValidator(req.body));
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, description, category, deadline, successCriteria, goalType, targetValue, targetUnit, parentGoalId } = parsed.data;
  const resolvedType = goalType ?? "habit";
  const resolvedCadence = requestedCadence ?? (resolvedType === "milestone" ? "one_time" : "daily");

  if (parentGoalId) {
    const err = await validateParent(userId, parentGoalId, null);
    if (err) { res.status(400).json({ error: err }); return; }
  }

  const goalId = nanoid();
  await db.insert(goalsTable).values({
    id: goalId,
    userId,
    parentGoalId: parentGoalId ?? null,
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
  });

  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, goalId));
  await recordActivityEvent({
    userId,
    eventType: "goal_created",
    source: "dashboard",
    goalId,
    title: "Goal created",
    description: title,
    progress: 0,
    currentValue: 0,
    targetValue: targetValue ?? null,
    targetUnit: targetUnit ?? null,
    metadata: { cadence: resolvedCadence },
  });
  res.status(201).json(goal);
});

router.get("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = GetGoalParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }
  res.json(goal);
});

router.patch("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const paramsParsed = UpdateGoalParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const requestedCadence = readCadence(req.body);
  if (requestedCadence === "__invalid__") { res.status(400).json({ error: "cadence must be daily, weekly, monthly, one_time, or ongoing" }); return; }
  const bodyParsed = UpdateGoalBody.safeParse(bodyForLegacyGeneratedValidator(req.body));
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { title, description, category, deadline, status, progress, successCriteria, goalType, targetValue, targetUnit, currentValue, parentGoalId } = bodyParsed.data;
  const [existing] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, paramsParsed.data.id), eq(goalsTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Goal not found" }); return; }

  if (parentGoalId !== undefined && parentGoalId !== null) {
    const err = await validateParent(userId, parentGoalId, paramsParsed.data.id);
    if (err) { res.status(400).json({ error: err }); return; }
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
  if (parentGoalId !== undefined) updates.parentGoalId = parentGoalId;
  if (requestedCadence && requestedCadence !== "__invalid__") {
    updates.cadence = requestedCadence;
    if (requestedCadence !== existing.cadence) {
      updates.progress = 0;
      updates.currentValue = 0;
      updates.lastProgressResetDate = null;
    }
  }

  const effectiveType = goalType ?? existing.goalType;
  const effectiveTarget = targetValue !== undefined ? targetValue : existing.targetValue;
  const effectiveCurrent = updates.currentValue !== undefined ? updates.currentValue : existing.currentValue;
  const isQuant = effectiveType === "target" || effectiveType === "average";

  if (isQuant && effectiveTarget && effectiveTarget > 0 && requestedCadence === undefined) {
    updates.progress = Math.min(100, Math.round((effectiveCurrent / effectiveTarget) * 100));
  } else if (!isQuant && progress !== undefined && requestedCadence === undefined) {
    updates.progress = progress;
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  await db.update(goalsTable).set(updates).where(and(eq(goalsTable.id, paramsParsed.data.id), eq(goalsTable.userId, userId)));
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, paramsParsed.data.id), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  const progressChanged = goal.progress !== existing.progress || goal.currentValue !== existing.currentValue;
  const statusChanged = goal.status !== existing.status;
  const eventType = statusChanged && goal.status === "completed"
    ? "goal_completed"
    : statusChanged && goal.status === "archived"
      ? "goal_archived"
      : progressChanged
        ? "goal_updated"
        : "goal_edited";
  const descriptionText = eventType === "goal_completed"
    ? `${goal.title} completed`
    : eventType === "goal_archived"
      ? `${goal.title} archived`
      : progressChanged
        ? `${goal.title} progress updated to ${goal.progress}%`
        : `${goal.title} details updated`;

  await recordActivityEvent({
    userId,
    eventType,
    source: "dashboard",
    goalId: goal.id,
    title: eventType === "goal_completed" ? "Goal completed" : eventType === "goal_archived" ? "Goal archived" : progressChanged ? "Goal updated" : "Goal edited",
    description: descriptionText,
    progress: goal.progress,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
    metadata: { changedFields: Object.keys(updates), cadence: goal.cadence },
  });

  res.json(goal);
});

router.delete("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const parsed = DeleteGoalParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [goal] = await db.select().from(goalsTable).where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)));
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }

  await recordActivityEvent({
    userId,
    eventType: "goal_deleted",
    source: "dashboard",
    goalId: goal.id,
    title: "Goal deleted",
    description: goal.title,
    progress: goal.progress,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
  });
  await db.delete(goalsTable).where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
