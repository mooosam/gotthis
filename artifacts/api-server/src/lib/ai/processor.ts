import { assembleContext } from "./context.js";
import { checkBudgetForUser, recordUsage, loadFreshBudget } from "./usage.js";
import { classifyIntentWithFallback } from "./classifier.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn, OFF_TOPIC_REPLY } from "./checkin.js";
import { checkPerMinuteThrottle } from "./throttle.js";

export interface ProcessMessageResult {
  reply: string;
  intent: string;
  dailyRemaining: number;
  monthlyTokenRemaining: number;
}

// Hard cap on the user-supplied message length passed to Claude. Both the
// dashboard route and the WhatsApp handler clamp at this length defensively
// so a single jumbo payload cannot inflate token usage past the budget guard.
const MAX_USER_MESSAGE_CHARS = 1000;

export async function processMessage(
  userId: string,
  message: string,
): Promise<ProcessMessageResult> {
  // Per-minute burst throttle. Sits ahead of the classifier and budget checks
  // so a scripted attacker cannot even trigger the cheap Haiku classifier.
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) {
    return {
      reply: `You are sending messages too quickly. Try again in about ${throttle.retryAfterSeconds} seconds.`,
      intent: "rate_limited",
      dailyRemaining: 0,
      monthlyTokenRemaining: 0,
    };
  }

  // Clamp incoming user text. Anything past the cap is silently truncated for
  // the AI; users almost never need more than 1k characters for a goal update.
  const safeMessage =
    message.length > MAX_USER_MESSAGE_CHARS
      ? message.slice(0, MAX_USER_MESSAGE_CHARS)
      : message;

  // Context assembly can throw if the user record is missing or the DB query
  // fails. Surface a user-friendly reply rather than letting callers (the AI
  // dashboard route, WhatsApp handler, etc.) see a 500.
  let ctx;
  try {
    ctx = await assembleContext(userId);
  } catch (err) {
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
    };
  }

  const classification = await classifyIntentWithFallback(safeMessage, initialBudget.monthlyTokenRemaining);
  const { intent } = classification;

  // Classifier could not determine intent (Haiku fallback failed). Surface a
  // user-friendly error rather than silently routing to the general handler.
  if (intent === "error") {
    return {
      reply: "I had trouble understanding that. Please try rephrasing — for example, share what you worked on today or how your morning is going.",
      intent: "error",
      dailyRemaining: initialBudget.dailyRemaining,
      monthlyTokenRemaining: initialBudget.monthlyTokenRemaining,
    };
  }

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
