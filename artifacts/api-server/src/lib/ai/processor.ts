import { assembleContext } from "./context.js";
import { checkBudgetForUser, recordUsage, loadFreshBudget } from "./usage.js";
import { determineIntent } from "./intent.js";
import { validateUserMessage } from "./policy.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn, OFF_TOPIC_REPLY } from "./checkin.js";
import { createGoalFromMessage } from "./goal-create.js";
import { checkPerMinuteThrottle } from "./throttle.js";
import { getBaseUrl } from "../whatsapp/magic-link.js";

export interface ProcessMessageResult {
  reply: string;
  intent: string;
  dailyRemaining: number;
  monthlyTokenRemaining: number;
  upgradePrompt?: { code: "TIER_GATE"; gate: "daily_cap" | "monthly_tokens"; upgradeRequired: "pro" | "elite"; message: string };
}

function renderProgressBar(progress: number, width = 16): string {
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  const filled = Math.round((pct / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function renderDashboardReply(ctx: Awaited<ReturnType<typeof assembleContext>>): string {
  const base = getBaseUrl();
  const goals = ctx.goals.slice(0, 5);
  if (goals.length === 0) return `You don't have any active goals yet. Add one here:\n\n${base}/dashboard`;

  const lines = ["📊 YOUR PROGRESS", ""];
  for (const goal of goals) {
    const title = goal.title.length > 24 ? `${goal.title.slice(0, 23)}…` : goal.title;
    const pct = Math.max(0, Math.min(100, Math.round(goal.progress ?? 0)));
    lines.push(`${title}`);
    lines.push(`${renderProgressBar(pct)} ${pct}%`);
  }
  if (ctx.goals.length > 5) lines.push(`\n+ ${ctx.goals.length - 5} more active goals`);
  lines.push(`\nOpen dashboard: ${base}/dashboard`);
  return lines.join("\n");
}

export async function processMessage(userId: string, message: string): Promise<ProcessMessageResult> {
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) return { reply: `You are sending messages too quickly. Try again in about ${throttle.retryAfterSeconds} seconds.`, intent: "rate_limited", dailyRemaining: 0, monthlyTokenRemaining: 0 };

  const policy = validateUserMessage(message);
  if (!policy.allowed) return { reply: policy.reply, intent: policy.reason, dailyRemaining: 0, monthlyTokenRemaining: 0 };
  const safeMessage = policy.normalizedMessage;

  let ctx;
  try { ctx = await assembleContext(userId); }
  catch {
    return { reply: "I couldn't load your goal context just now. Please try again in a moment.", intent: "error", dailyRemaining: 0, monthlyTokenRemaining: 0 };
  }

  const initialBudget = checkBudgetForUser(ctx.user);
  if (!initialBudget.allowed) return { reply: initialBudget.reason ?? "You have reached your usage limit.", intent: "budget_exceeded", dailyRemaining: initialBudget.dailyRemaining, monthlyTokenRemaining: initialBudget.monthlyTokenRemaining, upgradePrompt: initialBudget.upgradePrompt };

  const classification = await determineIntent(safeMessage, initialBudget.monthlyTokenRemaining);
  const { intent } = classification;

  if (classification.inputTokens > 0 || classification.outputTokens > 0) {
    const provisionalUser = { ...ctx.user, monthlyTokenCount: ctx.user.monthlyTokenCount + classification.inputTokens + classification.outputTokens };
    const provisionalBudget = checkBudgetForUser(provisionalUser);
    if (!provisionalBudget.allowed) {
      await recordUsage(userId, classification.inputTokens, classification.outputTokens, 0);
      return { reply: provisionalBudget.reason ?? "You have reached your usage limit.", intent: "budget_exceeded", dailyRemaining: provisionalBudget.dailyRemaining, monthlyTokenRemaining: provisionalBudget.monthlyTokenRemaining, upgradePrompt: provisionalBudget.upgradePrompt };
    }
  }

  let totalInputTokens = classification.inputTokens;
  let totalOutputTokens = classification.outputTokens;
  let totalCacheHitTokens = 0;
  let reply: string;

  if (intent === "dashboard") {
    reply = renderDashboardReply(ctx);
  } else if (intent === "goal_create") {
    const result = await createGoalFromMessage(ctx, safeMessage);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
  } else if (intent === "off_topic") reply = OFF_TOPIC_REPLY;
  else if (intent === "morning_ritual") {
    const result = await runMorningRitual(ctx, safeMessage); reply = result.response; totalInputTokens += result.inputTokens; totalOutputTokens += result.outputTokens; totalCacheHitTokens += result.cacheHitTokens;
  } else if (intent === "evening_ritual") {
    const result = await runEveningRitual(ctx, safeMessage); reply = result.response; totalInputTokens += result.inputTokens; totalOutputTokens += result.outputTokens; totalCacheHitTokens += result.cacheHitTokens;
  } else {
    const result = await runCheckIn(ctx, safeMessage, intent); reply = result.response; totalInputTokens += result.inputTokens; totalOutputTokens += result.outputTokens; totalCacheHitTokens += result.cacheHitTokens;
  }

  await recordUsage(userId, totalInputTokens, totalOutputTokens, totalCacheHitTokens);
  const { budget: freshBudget } = await loadFreshBudget(userId);
  return { reply, intent, dailyRemaining: freshBudget.dailyRemaining, monthlyTokenRemaining: freshBudget.monthlyTokenRemaining };
}
