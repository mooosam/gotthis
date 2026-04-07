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

  const intent = await classifyIntentWithFallback(message);

  if (intent === "off_topic") {
    return {
      reply: OFF_TOPIC_REPLY,
      intent: "off_topic",
      dailyRemaining: initialBudget.dailyRemaining,
      monthlyTokenRemaining: initialBudget.monthlyTokenRemaining,
    };
  }

  let reply: string;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHitTokens = 0;

  if (intent === "morning_ritual") {
    const result = await runMorningRitual(ctx, message);
    reply = result.response;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    cacheHitTokens = result.cacheHitTokens;
  } else if (intent === "evening_ritual") {
    const result = await runEveningRitual(ctx, message);
    reply = result.response;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    cacheHitTokens = result.cacheHitTokens;
  } else {
    const result = await runCheckIn(ctx, message, intent);
    reply = result.response;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    cacheHitTokens = result.cacheHitTokens;
  }

  if (inputTokens > 0 || outputTokens > 0) {
    await recordUsage(userId, inputTokens, outputTokens, cacheHitTokens);
  }

  const { budget: freshBudget } = await loadFreshBudget(userId);

  return {
    reply,
    intent,
    dailyRemaining: freshBudget.dailyRemaining,
    monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
  };
}
