import { assembleContext } from "./context.js";
import { checkUsageBudget, recordUsage } from "./usage.js";
import { classifyIntent } from "./classifier.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn } from "./checkin.js";

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

  const budget = await checkUsageBudget(ctx.user);
  if (!budget.allowed) {
    return {
      reply: budget.reason ?? "You have reached your usage limit.",
      intent: "budget_exceeded",
      dailyRemaining: budget.dailyRemaining,
      monthlyTokenRemaining: budget.monthlyTokenRemaining,
    };
  }

  const intent = classifyIntent(message);

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

  await recordUsage(userId, inputTokens, outputTokens, cacheHitTokens);

  const updatedBudget = await checkUsageBudget(ctx.user);

  return {
    reply,
    intent,
    dailyRemaining: Math.max(0, updatedBudget.dailyRemaining - 1),
    monthlyTokenRemaining: Math.max(
      0,
      updatedBudget.monthlyTokenRemaining - inputTokens - outputTokens,
    ),
  };
}
