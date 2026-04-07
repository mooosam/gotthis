import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, dailyLogsTable, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";
import { processMessage } from "../lib/ai/processor.js";
import { refreshMemorySummary } from "../lib/ai/memory.js";

const router: IRouter = Router();

router.post("/ai/message", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const { message } = req.body as { message?: unknown };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message must be a non-empty string" });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: "message must be 2000 characters or fewer" });
    return;
  }

  const result = await processMessage(userId, message);
  const today = new Date().toISOString().split("T")[0];
  const goalMatches = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId));
  const matchedGoalStatuses = goalMatches
    .filter((goal) => message.toLowerCase().includes(goal.title.toLowerCase()))
    .map((goal) => ({
      goalId: goal.id,
      title: goal.title,
      progressNote: message,
    }));
  const existingGoalLog = await db
    .select()
    .from(dailyLogsTable)
    .where(and(eq(dailyLogsTable.userId, userId), eq(dailyLogsTable.logDate, today)))
    .limit(1);

  if (existingGoalLog.length > 0) {
    const existingData = (existingGoalLog[0].data as Record<string, unknown> | null) ?? {};
    const existingGoalStatuses = (existingData.goalStatuses as Array<{
      goalId?: string;
      title?: string;
      progressNote?: string;
    }> | undefined) ?? [];
    const payload = {
      goalStatuses: [...existingGoalStatuses, ...matchedGoalStatuses],
      personalNotes: message,
    };
    await db
      .update(dailyLogsTable)
      .set({ data: { ...existingData, ...payload } })
      .where(eq(dailyLogsTable.id, existingGoalLog[0].id));
  } else {
    await db.insert(dailyLogsTable).values({
      id: nanoid(),
      userId,
      logDate: today,
      data: {
        personalNotes: message,
        goalStatuses: matchedGoalStatuses,
      },
      narrative: result.reply,
    });
  }

  for (const goalStatus of matchedGoalStatuses) {
    const goal = goalMatches.find((item) => item.id === goalStatus.goalId);
    if (!goal) continue;
    await db
      .update(goalsTable)
      .set({
        progress: Math.min(100, goal.progress + 5),
        lastCheckedAt: new Date(),
      })
      .where(eq(goalsTable.id, goal.id));
  }

  res.json({
    reply: result.reply,
    intent: result.intent,
    usage: {
      dailyRemaining: result.dailyRemaining,
      monthlyTokenRemaining: result.monthlyTokenRemaining,
    },
  });
});

router.post("/ai/memory/refresh", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const summary = await refreshMemorySummary(userId);

  res.json({ summary });
});

export default router;
