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
  // Tightened from 2000 to 1000 chars. A goal coaching message never needs more,
  // and a smaller window limits prompt-injection payload size.
  if (message.length > 1000) {
    res.status(400).json({ error: "message must be 1000 characters or fewer" });
    return;
  }

  const result = await processMessage(userId, message);

  // Surface throttle / budget refusals as the right HTTP status so the client
  // can react (and so abusers see 429s, not 200s).
  if (result.intent === "rate_limited") {
    res.status(429).json({ error: result.reply });
    return;
  }
  if (result.intent === "budget_exceeded") {
    // Return 402 with a structured upgrade prompt so the dashboard can render
    // an inline upgrade CTA instead of a generic error toast.
    res.status(402).json({
      error: result.reply,
      ...(result.upgradePrompt
        ? {
            code: result.upgradePrompt.code,
            gate: result.upgradePrompt.gate,
            upgradeRequired: result.upgradePrompt.upgradeRequired,
            message: result.upgradePrompt.message,
            checkoutPath: "/account#billing",
          }
        : {}),
    });
    return;
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

  // Per-minute throttle: a script could otherwise burn the user's monthly
  // token budget in a few seconds by hammering this Haiku-backed endpoint.
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) {
    res.status(429).json({
      error: `Too many requests. Try again in about ${throttle.retryAfterSeconds} seconds.`,
    });
    return;
  }

  const { budget } = await loadFreshBudget(userId);
  if (!budget.allowed) {
    res.status(429).json({ error: budget.reason ?? "Usage limit reached." });
    return;
  }

  const { summary, inputTokens, outputTokens } = await refreshMemorySummary(userId);

  await recordUsage(userId, inputTokens, outputTokens, 0);

  res.json({ summary });
});

export default router;
