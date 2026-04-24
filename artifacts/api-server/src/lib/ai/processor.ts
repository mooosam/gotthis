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

  const classification = await classifyIntentWithFallback(message, initialBudget.monthlyTokenRemaining);
  const { intent } = classification;

  // If the classifier used Claude (AI fallback), apply those tokens to a provisional
  // in-memory budget check before running the more expensive handler call.  This
  // prevents a user who is at the edge of their monthly allowance from consuming a
  // second model call after the classifier already pushed them over the limit.
  if (classification.inputTokens > 0 || classification.outputTokens > 0) {
    const provisionalUser = {
      ...ctx.user,
      monthlyTokenCount:
        ctx.user.monthlyTokenCount + classification.inputTokens + classification.outputTokens,
    };
    const provisionalBudget = checkBudgetForUser(provisionalUser);
    if (!provisionalBudget.allowed) {
      // Persist classifier tokens so usage is accurately accounted for.
      await recordUsage(userId, classification.inputTokens, classification.outputTokens, 0);
      return {
        reply: provisionalBudget.reason ?? "You have reached your usage limit.",
        intent: "budget_exceeded",
        dailyRemaining: provisionalBudget.dailyRemaining,
        monthlyTokenRemaining: provisionalBudget.monthlyTokenRemaining,
      };
    }
  }

  let totalInputTokens = classification.inputTokens;
  let totalOutputTokens = classification.outputTokens;
  let totalCacheHitTokens = 0;

  let reply: string;

  if (intent === "off_topic") {
    reply = OFF_TOPIC_REPLY;
  } else if (intent === "morning_ritual") {
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

  // Record all accumulated usage (classifier + handler) in one write.  This also
  // increments the daily message count exactly once per user-facing interaction.
  await recordUsage(userId, totalInputTokens, totalOutputTokens, totalCacheHitTokens);

  const { budget: freshBudget } = await loadFreshBudget(userId);

  return {
    reply,
    intent,
    dailyRemaining: freshBudget.dailyRemaining,
    monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
  };
}
