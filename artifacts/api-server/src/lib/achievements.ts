import {
  activityEventsTable,
  achievementsTable,
  db,
  goalsTable,
  milestonesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "./logger.js";

export interface AchievementEventInput {
  userId: string;
  eventType: string;
  goalId?: string | null;
  milestoneId?: string | null;
  progress?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  occurredAt?: Date;
}

interface CreateAchievementInput {
  userId: string;
  goalId?: string | null;
  milestoneId?: string | null;
  achievementType: string;
  title: string;
  subtitle?: string | null;
  value?: number | null;
  valueLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey: string;
}

async function createAchievement(input: CreateAchievementInput): Promise<boolean> {
  try {
    await db.insert(achievementsTable).values({
      id: nanoid(),
      userId: input.userId,
      goalId: input.goalId ?? null,
      milestoneId: input.milestoneId ?? null,
      achievementType: input.achievementType,
      title: input.title.slice(0, 500),
      subtitle: input.subtitle?.slice(0, 500) ?? null,
      value: input.value ?? null,
      valueLabel: input.valueLabel?.slice(0, 100) ?? null,
      metadata: input.metadata ?? null,
      dedupeKey: input.dedupeKey,
      shareToken: null,
      sharedAt: null,
    });
    return true;
  } catch {
    logger.debug({ userId: input.userId, dedupeKey: input.dedupeKey }, "Achievement already recorded");
    return false;
  }
}

function localDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function periodKey(cadence: string, date: Date, timezone: string): string {
  const iso = localDate(date, timezone);
  if (cadence === "monthly") return iso.slice(0, 7);
  if (cadence === "weekly") {
    const [year, month, day] = iso.split("-").map(Number);
    const local = new Date(Date.UTC(year, month - 1, day));
    const weekday = local.getUTCDay() || 7;
    local.setUTCDate(local.getUTCDate() - weekday + 1);
    return local.toISOString().slice(0, 10);
  }
  return iso;
}

export async function evaluateAchievementsForEvent(input: AchievementEventInput): Promise<void> {
  try {
    const occurredAt = input.occurredAt ?? new Date();
    const [user] = await db
      .select({ timezone: usersTable.timezone })
      .from(usersTable)
      .where(eq(usersTable.id, input.userId));
    const timezone = user?.timezone || "UTC";

    let goal: typeof goalsTable.$inferSelect | null = null;
    if (input.goalId) {
      const [row] = await db
        .select()
        .from(goalsTable)
        .where(and(eq(goalsTable.id, input.goalId), eq(goalsTable.userId, input.userId)));
      goal = row ?? null;
    }

    if (input.eventType === "milestone_completed") {
      await createAchievement({
        userId: input.userId,
        goalId: input.goalId,
        milestoneId: input.milestoneId,
        achievementType: "first_milestone",
        title: "First milestone completed",
        subtitle: goal?.title ?? "A meaningful step forward",
        dedupeKey: `first_milestone:${input.userId}`,
      });
    }

    if (input.eventType === "goal_completed" && input.goalId) {
      await createAchievement({
        userId: input.userId,
        goalId: input.goalId,
        achievementType: "goal_completed",
        title: "Goal completed",
        subtitle: goal?.title ?? "Goal complete",
        value: 100,
        valueLabel: "% complete",
        dedupeKey: `goal_completed:${input.goalId}`,
      });
    }

    if (goal && (goal.cadence === "weekly" || goal.cadence === "monthly") && (input.progress ?? goal.progress) >= 100) {
      const key = periodKey(goal.cadence, occurredAt, timezone);
      const cadenceLabel = goal.cadence === "weekly" ? "Weekly goal reached" : "Monthly goal reached";
      await createAchievement({
        userId: input.userId,
        goalId: goal.id,
        achievementType: `${goal.cadence}_goal_complete`,
        title: cadenceLabel,
        subtitle: goal.title,
        value: goal.targetValue ?? 100,
        valueLabel: goal.targetValue && goal.targetUnit ? goal.targetUnit : "% complete",
        metadata: {
          cadence: goal.cadence,
          periodKey: key,
          currentValue: input.currentValue ?? goal.currentValue,
          targetValue: input.targetValue ?? goal.targetValue,
          targetUnit: input.targetUnit ?? goal.targetUnit,
        },
        dedupeKey: `${goal.cadence}_complete:${goal.id}:${key}`,
      });
    }

    if (goal && goal.currentStreak > 0) {
      for (const threshold of [7, 30, 100]) {
        if (goal.currentStreak >= threshold) {
          await createAchievement({
            userId: input.userId,
            goalId: goal.id,
            achievementType: "streak",
            title: `${threshold}-day streak`,
            subtitle: goal.title,
            value: threshold,
            valueLabel: "days",
            metadata: { currentStreak: goal.currentStreak },
            dedupeKey: `streak:${goal.id}:${threshold}`,
          });
        }
      }
    }

    const isCheckIn = ["check_in", "morning_check_in", "evening_check_in"].includes(input.eventType);
    if (isCheckIn) {
      const checkIns = await db
        .select({ id: activityEventsTable.id })
        .from(activityEventsTable)
        .where(
          and(
            eq(activityEventsTable.userId, input.userId),
            or(
              eq(activityEventsTable.eventType, "check_in"),
              eq(activityEventsTable.eventType, "morning_check_in"),
              eq(activityEventsTable.eventType, "evening_check_in"),
            ),
          ),
        );
      const count = checkIns.length;
      for (const threshold of [10, 25, 50, 100]) {
        if (count >= threshold) {
          await createAchievement({
            userId: input.userId,
            achievementType: "check_in_count",
            title: `${threshold} check-ins`,
            subtitle: "Consistency is becoming a habit",
            value: threshold,
            valueLabel: "check-ins",
            dedupeKey: `checkins:${input.userId}:${threshold}`,
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ err, userId: input.userId, eventType: input.eventType }, "Achievement evaluation failed");
  }
}

export async function reconcileAchievementsForUser(userId: string): Promise<void> {
  try {
    const goals = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId));
    for (const goal of goals) {
      await evaluateAchievementsForEvent({
        userId,
        eventType: goal.status === "completed" ? "goal_completed" : "reconcile",
        goalId: goal.id,
        progress: goal.progress,
        currentValue: goal.currentValue,
        targetValue: goal.targetValue,
        targetUnit: goal.targetUnit,
      });
    }

    const [completedMilestone] = await db
      .select()
      .from(milestonesTable)
      .where(and(eq(milestonesTable.userId, userId), eq(milestonesTable.completed, true)))
      .limit(1);
    if (completedMilestone) {
      await evaluateAchievementsForEvent({
        userId,
        eventType: "milestone_completed",
        goalId: completedMilestone.goalId,
        milestoneId: completedMilestone.id,
        occurredAt: completedMilestone.completedAt ?? completedMilestone.updatedAt,
      });
    }

    // Reconcile check-in thresholds from the durable activity ledger.
    await evaluateAchievementsForEvent({ userId, eventType: "check_in" });
  } catch (err) {
    logger.warn({ err, userId }, "Achievement reconciliation failed");
  }
}
