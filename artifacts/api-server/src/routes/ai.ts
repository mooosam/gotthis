import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { processMessage } from "../lib/ai/processor.js";
import { refreshMemorySummary } from "../lib/ai/memory.js";
import { loadFreshBudget, recordUsage } from "../lib/ai/usage.js";
import { checkPerMinuteThrottle } from "../lib/ai/throttle.js";

const router: IRouter = Router();

router.post("/ai/message", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { message } = req.body as { message?: unknown };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message must be a non-empty string" });
    return;
  }
  if (message.length > 1000) {
    res.status(400).json({ error: "message must be 1000 characters or fewer" });
    return;
  }

  const result = await processMessage(userId, message, "dashboard");
  if (result.intent === "rate_limited") { res.status(429).json({ error: result.reply }); return; }
  if (result.intent === "budget_exceeded") {
    res.status(402).json({
      error: result.reply,
      ...(result.upgradePrompt ? {
        code: result.upgradePrompt.code,
        gate: result.upgradePrompt.gate,
        upgradeRequired: result.upgradePrompt.upgradeRequired,
        message: result.upgradePrompt.message,
        checkoutPath: "/account#billing",
      } : {}),
    });
    return;
  }

  res.json({
    reply: result.reply,
    intent: result.intent,
    usage: { dailyRemaining: result.dailyRemaining, monthlyTokenRemaining: result.monthlyTokenRemaining },
  });
});

router.post("/ai/memory/refresh", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) {
    res.status(429).json({ error: `Too many requests. Try again in about ${throttle.retryAfterSeconds} seconds.` });
    return;
  }

  const { budget } = await loadFreshBudget(userId);
  if (!budget.allowed) { res.status(429).json({ error: budget.reason ?? "Usage limit reached." }); return; }
  const { summary, inputTokens, outputTokens } = await refreshMemorySummary(userId);
  await recordUsage(userId, inputTokens, outputTokens, 0);
  res.json({ summary });
});

export default router;
