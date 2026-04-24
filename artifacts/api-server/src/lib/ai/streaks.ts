import { db, goalsTable, milestonesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const STREAK_MILESTONES = [7, 14, 30, 60, 100];

function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getDateString(d);
}

function getDayBeforeYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return getDateString(d);
}

export interface StreakUpdateResult {
  goalId: string;
  goalTitle: string;
  newStreak: number;
  hitMilestone: number | null;
  wasGrace: boolean;
}

export async function updateStreakForGoal(
  goalId: string,
  userId: string,
  goalTitle: string,
  percentProgress: number,
): Promise<StreakUpdateResult | null> {
  if (percentProgress < 100) return null;

  const today = getDateString(new Date());
  const yesterday = getYesterdayString();
  const dayBeforeYesterday = getDayBeforeYesterdayString();

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

  if (!goal) return null;

  if (goal.lastStreakDate === today) {
    return null;
  }

  let newStreak = goal.currentStreak;
  let newGraceUsed = goal.graceUsed;
  let wasGrace = false;

  if (!goal.lastStreakDate || goal.lastStreakDate < dayBeforeYesterday) {
    newStreak = 1;
    newGraceUsed = false;
  } else if (goal.lastStreakDate === yesterday) {
    newStreak = goal.currentStreak + 1;
    newGraceUsed = false;
  } else if (goal.lastStreakDate === dayBeforeYesterday) {
    if (!goal.graceUsed) {
      newStreak = goal.currentStreak + 1;
      newGraceUsed = true;
      wasGrace = true;
    } else {
      newStreak = 1;
      newGraceUsed = false;
    }
  }

  const newLongest = Math.max(newStreak, goal.longestStreak);
  const hitMilestone = STREAK_MILESTONES.includes(newStreak) ? newStreak : null;

  await db
    .update(goalsTable)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastStreakDate: today,
      graceUsed: newGraceUsed,
    })
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));

  return { goalId, goalTitle, newStreak, hitMilestone, wasGrace };
}

export async function getActiveMilestone(
  goalId: string,
  userId: string,
): Promise<{ id: string; title: string; order: number } | null> {
  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(
      and(
        eq(milestonesTable.goalId, goalId),
        eq(milestonesTable.userId, userId),
      ),
    );

  if (milestones.length === 0) return null;

  const sorted = milestones.sort((a, b) => a.order - b.order);
  const active = sorted.find((m) => !m.completed);
  return active ? { id: active.id, title: active.title, order: active.order } : null;
}

export function buildShareUrl(shareToken: string): string {
  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";
  return `${baseUrl}/share/${shareToken}`;
}
