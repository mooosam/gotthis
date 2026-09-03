import { assembleContext } from "./context.js";
import { checkBudgetForUser, recordUsage, loadFreshBudget } from "./usage.js";
import { determineIntent } from "./intent.js";
import { validateUserMessage } from "./policy.js";
import { runMorningRitual } from "./morning.js";
import { runEveningRitual } from "./evening.js";
import { runCheckIn, OFF_TOPIC_REPLY } from "./checkin.js";
import { createGoalFromMessage, cadenceFromClarification, completePendingGoalCadence } from "./goal-create.js";
import { deleteGoalFromMessage, looksLikeExplicitGoalDelete } from "./goal-delete.js";
import { checkPerMinuteThrottle } from "./throttle.js";
import { createAuthenticatedShortLink } from "../whatsapp/auth-link.js";
import { recordActivityEvent, type ActivitySource } from "../activity-events.js";

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

async function renderDashboardReply(ctx: Awaited<ReturnType<typeof assembleContext>>): Promise<string> {
  const dashboardUrl = await createAuthenticatedShortLink(ctx.user.id, "/dashboard");
  const goals = ctx.goals.slice(0, 5);
  if (goals.length === 0) return `You don't have any active goals yet. Add one here:\n\n${dashboardUrl}`;
  const lines = ["📊 YOUR PROGRESS", ""];
  for (const goal of goals) {
    const title = goal.title.length > 24 ? `${goal.title.slice(0, 23)}…` : goal.title;
    const pct = Math.max(0, Math.min(100, Math.round(goal.progress ?? 0)));
    lines.push(title);
    lines.push(`${renderProgressBar(pct)} ${pct}%`);
  }
  if (ctx.goals.length > 5) lines.push(`\n+ ${ctx.goals.length - 5} more active goals`);
  lines.push(`\nOpen dashboard: ${dashboardUrl}`);
  return lines.join("\n");
}

export async function processMessage(
  userId: string,
  message: string,
  source: ActivitySource = "dashboard",
): Promise<ProcessMessageResult> {
  const throttle = checkPerMinuteThrottle(userId);
  if (!throttle.allowed) return { reply: `You are sending messages too quickly. Try again in about ${throttle.retryAfterSeconds} seconds.`, intent: "rate_limited", dailyRemaining: 0, monthlyTokenRemaining: 0 };

  const policy = validateUserMessage(message);
  if (!policy.allowed) return { reply: policy.reply, intent: policy.reason, dailyRemaining: 0, monthlyTokenRemaining: 0 };
  const safeMessage = policy.normalizedMessage;

  let ctx;
  try { ctx = await assembleContext(userId); }
  catch { return { reply: "I couldn't load your goal context just now. Please try again in a moment.", intent: "error", dailyRemaining: 0, monthlyTokenRemaining: 0 }; }

  const initialBudget = checkBudgetForUser(ctx.user);
  if (!initialBudget.allowed) return { reply: initialBudget.reason ?? "You have reached your usage limit.", intent: "budget_exceeded", dailyRemaining: initialBudget.dailyRemaining, monthlyTokenRemaining: initialBudget.monthlyTokenRemaining, upgradePrompt: initialBudget.upgradePrompt };

  // Cadence clarification is conversational state, not a fresh intent. Handle a
  // reply such as "weekly" before classification so it completes the pending
  // goal instead of being mistaken for an unrelated one-word message.
  const pendingCadence = cadenceFromClarification(safeMessage);
  if (pendingCadence && ctx.user.pendingGoalDraft) {
    const result = await completePendingGoalCadence(ctx, pendingCadence, source);
    await recordUsage(userId, 0, 0, 0);
    const { budget: freshBudget } = await loadFreshBudget(userId);
    return {
      reply: result.response,
      intent: "goal_create",
      dailyRemaining: freshBudget.dailyRemaining,
      monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
    };
  }

  // A direct single-goal delete is a backend action, not a coaching response.
  // Handle strong explicit wording before AI classification so the model can
  // never claim a goal was removed without the database mutation occurring.
  if (looksLikeExplicitGoalDelete(safeMessage)) {
    const result = await deleteGoalFromMessage(ctx, safeMessage, source);
    await recordUsage(userId, 0, 0, 0);
    const { budget: freshBudget } = await loadFreshBudget(userId);
    return {
      reply: result.response,
      intent: "goal_delete",
      dailyRemaining: freshBudget.dailyRemaining,
      monthlyTokenRemaining: freshBudget.monthlyTokenRemaining,
    };
  }

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
    try { reply = await renderDashboardReply(ctx); }
    catch { reply = "I couldn't create a secure dashboard link just now. Please try again in a moment."; }
  } else if (intent === "goal_create") {
    const result = await createGoalFromMessage(ctx, safeMessage, source);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
  } else if (intent === "goal_delete") {
    const result = await deleteGoalFromMessage(ctx, safeMessage, source);
    reply = result.response;
  } else if (intent === "off_topic") {
    reply = OFF_TOPIC_REPLY;
  } else if (intent === "morning_ritual") {
    const result = await runMorningRitual(ctx, safeMessage);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
    await recordActivityEvent({ userId, eventType: "morning_check_in", source, title: "Morning check-in", description: safeMessage });
  } else if (intent === "evening_ritual") {
    const result = await runEveningRitual(ctx, safeMessage);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;
    await recordActivityEvent({ userId, eventType: "evening_check_in", source, title: "Evening check-in", description: safeMessage });
  } else {
    const result = await runCheckIn(ctx, safeMessage, intent);
    reply = result.response;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCacheHitTokens += result.cacheHitTokens;

    if (intent === "goal_update") {
      try {
        const fresh = await assembleContext(userId);
        const before = new Map(ctx.goals.map((goal) => [goal.id, goal]));
        for (const goal of fresh.goals) {
          const prior = before.get(goal.id);
          if (!prior || (goal.progress === prior.progress && goal.currentValue === prior.currentValue)) continue;
          await recordActivityEvent({
            userId,
            eventType: goal.progress >= 100 && prior.progress < 100 ? "goal_completed" : "goal_updated",
            source,
            goalId: goal.id,
            title: goal.progress >= 100 && prior.progress < 100 ? "Goal completed" : "Goal updated",
            description: safeMessage,
            progress: goal.progress,
            currentValue: goal.currentValue,
            targetValue: goal.targetValue,
            targetUnit: goal.targetUnit,
            metadata: { previousProgress: prior.progress, previousCurrentValue: prior.currentValue },
          });
        }
      } catch {
        // Progress persistence already succeeded; failure to enrich the activity ledger
        // must not turn a valid user check-in into an error.
      }
    } else if (intent === "check_in") {
      await recordActivityEvent({ userId, eventType: "check_in", source, title: "Check-in", description: safeMessage });
    }
  }

  await recordUsage(userId, totalInputTokens, totalOutputTokens, totalCacheHitTokens);
  const { budget: freshBudget } = await loadFreshBudget(userId);
  return { reply, intent, dailyRemaining: freshBudget.dailyRemaining, monthlyTokenRemaining: freshBudget.monthlyTokenRemaining };
}
