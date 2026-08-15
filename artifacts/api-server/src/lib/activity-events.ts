import { db, activityEventsTable } from "@workspace/db";
import { nanoid } from "nanoid";
import { logger } from "./logger.js";

export type ActivitySource = "dashboard" | "whatsapp" | "api" | "system";

export interface RecordActivityEventInput {
  userId: string;
  eventType: string;
  source: ActivitySource;
  title: string;
  description?: string | null;
  goalId?: string | null;
  milestoneId?: string | null;
  progress?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  occurredAt?: Date;
}

export async function recordActivityEvent(input: RecordActivityEventInput): Promise<void> {
  try {
    await db.insert(activityEventsTable).values({
      id: nanoid(),
      userId: input.userId,
      eventType: input.eventType,
      source: input.source,
      title: input.title.slice(0, 500),
      description: input.description?.slice(0, 2000) ?? null,
      goalId: input.goalId ?? null,
      milestoneId: input.milestoneId ?? null,
      progress: input.progress == null ? null : Math.max(0, Math.min(100, Math.round(input.progress))),
      currentValue: input.currentValue == null ? null : Math.max(0, Math.round(input.currentValue)),
      targetValue: input.targetValue == null ? null : Math.max(0, Math.round(input.targetValue)),
      targetUnit: input.targetUnit?.slice(0, 100) ?? null,
      metadata: input.metadata ?? null,
      dedupeKey: input.dedupeKey ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (err) {
    logger.warn(
      { err, userId: input.userId, eventType: input.eventType },
      "Failed to record activity event",
    );
  }
}
