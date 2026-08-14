import { assembleContext } from "./context.js";
import { checkBudgetForUser, recordUsage, loadFreshBudget } from "./usage.js";
import { classifyIntentWithFallback } from "./classifier.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn, OFF_TOPIC_REPLY } from "./checkin.js";
import { checkPerMinuteThrottle } from "./throttle.js";
import { getBaseUrl } from "../whatsapp/magic-link.js";

export interface ProcessMessageResult {
  reply: string;
  intent: string;
  dailyRemaining: number;
  monthlyTokenRemaining: number;
  upgradePrompt?: {
    code: "TIER_GATE";
    gate: "daily_cap" | "monthly_tokens";
    upgradeRequired: "pro" | "elite";
    message: string;
  };
}

const MAX_USER_MESSAGE_CHARS = 1000;

export async function processMessage(
  userId: string,
  message: string,
): Promise<ProcessMessageResult> {
  // Throttle before classification so rapid repeat messages do not consume
  // Gemini tokens or other AI budget while the user is rate limited.
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) {
    return {
      reply: `You are sending messages too quickly. Try again in about ${throttle.retryAfterSeconds} seconds.`,
      intent: "rate_limited",
      dailyRemaining: 0,
      monthlyTokenRemaining: 0,
    };
  }

  // Keep untrusted user input bounded before sending it to the classifier and
  // downstream prompts, preventing unexpectedly large messages from consuming
  // excessive context/tokens.
  const safeMessage =
    message.length > MAX_USER_MESSAGE_CHARS
      ? message.slice(0, MAX_USER_MESSAGE_CHARS)
      : message;

  let ctx;
  try {
    ctx = await assembleContext(userId);
  } catch (err) {
    // Context assembly can fail independently of the user's message. Return a
    // friendly retry response rather than exposing an internal DB/context error.
    return {
      reply: "I couldn't load your goal context just now. Please try again in a moment.",
      intent: "error",
      dailyRemaining: 0,
      monthlyTokenRemaining: 0,
    };
  }

  const initialBudget = checkBudgetForUser(ctx.user);
  if (!initialBudget.allowed) {
    return {
      reply: initialBudget.reason ?? "You have reached your usage limit.",
      intent: "budget_exceeded",
      dailyRemaining: initialBudget.dailyRemaining,
      monthlyTokenRemaining: initialBudget.monthlyTokenRemaining,
      upgradePrompt: initialBudget.upgradePrompt,
    };
  }

  const classification = await classifyIntentWithFallback(safeMessage, initialBudget.monthlyTokenRemaining);
  const { intent } = classification;

  if (intent === "error") {
    return {
      reply: "I had trouble understanding that. Please try rephrasing — for example, share what you worked on today or how your morning is going.",
      intent: "error",
      dailyRemaining: initialBudget.dailyRemaining,
      monthlyTokenRemaining: initialBudget.monthlyTokenRemaining,
    };
  }

  // Classification consumes tokens before the final handler runs. Check the
  // provisional total here so a message cannot start an AI operation that would
  // push the user over their monthly allowance.
  if (classification.inputTokens > 0 || classification.outputTokens > 0) {
    const provisionalUser = {
      ...ctx.user,
      monthlyTokenCount:
        ctx.user.monthlyTokenCount + classification.inputTokens + classification.outputTokens,
    };
    const provisionalBudget = checkBudgetForUser(provisionalUser);
    if (!provisionalBudget.allowed) {
      await recordUsage(userId, classification.inputTokens, classification.outputTokens, 0);
      return {
        reply: provisionalBudget.reason ?? "You have reached your usage limit.",
        intent: "budget_exceeded",
        dailyRemaining: provisionalBudget.dailyRemaining,
        monthlyTokenRemaining: provisionalBudget.monthlyTokenRemaining,
        upgradePrompt: provisionalBudget.upgradePrompt,
      };
    }
  }

  let totalInputTokens = classification.inputTokens;
  let totalOutputTokens = classification.outputTokens;
  let totalCacheHitTokens = 0;
  let reply: string;

  if (intent === "dashboard") {
    reply = `Here’s your GotThis dashboard:\n\n${getBaseUrl()}/dashboard`;
  } else if (intent === "off_topic") {
    reply = OFF_TOPIC_REPLY;
  } else if (intent === "morning_ritual") {
    const result = await runMorningRitual(ctx, safeMessage);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  } else if (intent === "evening_ritual") {
    const result = await runEveningRitual(ctx, safeMessage);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  } else {
    const result = await runCheckIn(ctx, safeMessage, intent);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
  }

  await recordUsage(userId, totalInputTokens, totalOutputTokens, totalCacheHitTokens);

  const { budget: freshBudget } = await loadFreshBudget(userId);

  return {
    reply,
    intent,
    dailyRemaining: freshBudget.dailyRemaining,
    monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
  };
}
