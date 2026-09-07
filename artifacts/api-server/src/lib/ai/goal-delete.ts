import { and, eq } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import type { UserContext } from "./context.js";
import { recordActivityEvent, type ActivitySource } from "../activity-events.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "anymore", "can", "could", "delete", "do", "dont", "from",
  "get", "goal", "goals", "i", "like", "me", "my", "of", "please", "remove",
  "rid", "stop", "the", "this", "to", "track", "tracking", "want", "would",
]);

const PENDING_DELETE_TTL_MS = 10 * 60 * 1000;
const pendingDeletes = new Map<string, { goalIds: string[]; expiresAt: number }>();

function normalizeToken(token: string): string {
  let value = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (value.endsWith("ies") && value.length > 4) value = `${value.slice(0, -3)}y`;
  else if (value.endsWith("es") && value.length > 4) value = value.slice(0, -2);
  else if (value.endsWith("s") && value.length > 3) value = value.slice(0, -1);
  return value;
}

function meaningfulTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-–—]/g, "")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function scoreGoalReference(message: string, title: string): number {
  const requested = meaningfulTokens(message);
  const titleTokens = new Set(meaningfulTokens(title));
  if (requested.length === 0 || titleTokens.size === 0) return 0;

  let matches = 0;
  for (const token of requested) if (titleTokens.has(token)) matches += 1;
  return matches / requested.length;
}

function getPendingGoalIds(userId: string): string[] | null {
  const pending = pendingDeletes.get(userId);
  if (!pending) return null;
  if (pending.expiresAt <= Date.now()) {
    pendingDeletes.delete(userId);
    return null;
  }
  return pending.goalIds;
}

export function hasPendingGoalDelete(userId: string): boolean {
  return getPendingGoalIds(userId) !== null;
}

export function looksLikeExplicitGoalDelete(message: string): boolean {
  return /\b(?:remove|delete)\b/i.test(message) || /\b(?:stop|dont|don't)\b.*\btrack(?:ing)?\b/i.test(message);
}

export async function deleteGoalFromMessage(
  ctx: UserContext,
  message: string,
  source: ActivitySource,
): Promise<{ response: string; deleted: boolean }> {
  if (ctx.goals.length === 0) {
    pendingDeletes.delete(ctx.user.id);
    return { response: "You don't have any active goals to remove.", deleted: false };
  }

  const pendingGoalIds = getPendingGoalIds(ctx.user.id);
  const candidateGoals = pendingGoalIds
    ? ctx.goals.filter((goal) => pendingGoalIds.includes(goal.id))
    : ctx.goals;

  if (pendingGoalIds && candidateGoals.length === 0) {
    pendingDeletes.delete(ctx.user.id);
    return { response: "Those goals are no longer active. Tell me which current goal you'd like to remove.", deleted: false };
  }

  const directId = candidateGoals.find((goal) => message.includes(goal.id));
  const ranked = directId
    ? [{ goal: directId, score: 1 }]
    : candidateGoals
        .map((goal) => ({ goal, score: scoreGoalReference(message, goal.title) }))
        .filter(({ score }) => score >= 0.6)
        .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    const names = candidateGoals.slice(0, 5).map((goal) => `“${goal.title}”`).join(", ");
    if (pendingGoalIds) {
      return {
        response: `I still need to know which one you mean: ${names}.`,
        deleted: false,
      };
    }
    return {
      response: `I couldn't find one active goal that clearly matches that request. Your active goals are ${names}. Tell me the exact one to remove.`,
      deleted: false,
    };
  }

  const best = ranked[0];
  const second = ranked[1];
  if (second && Math.abs(best.score - second.score) < 0.15) {
    const tied = ranked
      .filter(({ score }) => Math.abs(best.score - score) < 0.15)
      .map(({ goal }) => goal);
    pendingDeletes.set(ctx.user.id, {
      goalIds: tied.map((goal) => goal.id),
      expiresAt: Date.now() + PENDING_DELETE_TTL_MS,
    });
    const names = tied.slice(0, 5).map((goal) => `“${goal.title}”`).join(" or ");
    return {
      response: `I found more than one match: ${names}. Which one should I remove?`,
      deleted: false,
    };
  }

  const goal = best.goal;

  await recordActivityEvent({
    userId: ctx.user.id,
    eventType: "goal_deleted",
    source,
    goalId: goal.id,
    title: "Goal deleted",
    description: goal.title,
    progress: goal.progress,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    targetUnit: goal.targetUnit,
    metadata: { via: "chat", cadence: goal.cadence },
  });

  await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, goal.id), eq(goalsTable.userId, ctx.user.id)));

  pendingDeletes.delete(ctx.user.id);
  return { response: `Done — I removed “${goal.title}”.`, deleted: true };
}
