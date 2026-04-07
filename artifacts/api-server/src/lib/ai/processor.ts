import { assembleContext } from "./context.js";
import { checkBudgetForUser, recordUsage, loadFreshBudget } from "./usage.js";
import { classifyIntentWithFallback } from "./classifier.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn, OFF_TOPIC_REPLY } from "./checkin.js";

export interface ProcessMessageResult {
  reply: string;
  intent: string;
  dailyRemaining: number;
  monthlyTokenRemaining: number;
}

export async function processMessage(
  userId: string,
  message: string,
): Promise<ProcessMessageResult> {
  const ctx = await assembleContext(userId);

  const initialBudget = checkBudgetForUser(ctx.user);
  if (!initialBudget.allowed) {
    return {
      reply: initialBudget.reason ?? "You have reached your usage limit.",
      intent: "budget_exceeded",
      dailyRemaining: initialBudget.dailyRemaining,
      monthlyTokenRemaining: initialBudget.monthlyTokenRemaining,
    };
  }

  const classification = await classifyIntentWithFallback(message);
  const { intent } = classification;

  let totalInputTokens = classification.inputTokens;
  let totalOutputTokens = classification.outputTokens;
  let totalCacheHitTokens = 0;

  if (intent === "off_topic") {
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      await recordUsage(userId, totalInputTokens, totalOutputTokens, 0);
    }
    const { budget: freshBudget } = await loadFreshBudget(userId);
    return {
      reply: OFF_TOPIC_REPLY,
      intent: "off_topic",
      dailyRemaining: freshBudget.dailyRemaining,
      monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
    };
  }

  let reply: string;

  if (intent === "morning_ritual") {
    const result = await runMorningRitual(ctx, message);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  } else if (intent === "evening_ritual") {
    const result = await runEveningRitual(ctx, message);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  } else {
    const result = await runCheckIn(ctx, message, intent);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  }

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    await recordUsage(userId, totalInputTokens, totalOutputTokens, totalCacheHitTokens);
  }

  const { budget: freshBudget } = await loadFreshBudget(userId);

  return {
    reply,
    intent,
    dailyRemaining: freshBudget.dailyRemaining,
    monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
  };
}
