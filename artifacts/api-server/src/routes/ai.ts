import { Router, type IRouter } from "express";
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
