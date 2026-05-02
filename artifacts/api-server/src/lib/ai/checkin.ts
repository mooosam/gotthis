import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, dailyLogsTable, goalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  buildSystemPrompt,
  buildStaticContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";
import { getTodayDate, loadFreshBudget, getCacheHitTokens } from "./usage.js";
import type { MessageIntent } from "./classifier.js";
import { logger } from "../logger.js";
import { updateStreakForGoal, getDateInTimezone } from "./streaks.js";

export const OFF_TOPIC_REPLY =
  "I'm your goal coach — let's focus on your targets.";

export interface CheckInResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}

interface ExtractedGoalUpdate {
  goalId: string;
  goalTitle: string;
  percentProgress: number;
  note: string;
}

async function extractAndSaveGoalProgress(
  ctx: UserContext,
  userMessage: string,
): Promise<{ updates: ExtractedGoalUpdate[]; inputTokens: number; outputTokens: number; cacheHitTokens: number }> {
  if (ctx.goals.length === 0) {
    return { updates: [], inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };
  }

  const goalListText = ctx.goals
    .map((g) => `[${g.id}] ${g.title} (current progress: ${g.progress}%)`)
    .join("\n");

  const extractionPrompt = `The user sent a goal progress update: "${userMessage}"

Their active goals (use the EXACT goalId strings shown in brackets):
${goalListText}

IMPORTANT: Reply with ONLY a raw JSON array — no markdown, no code fences, no explanation. Start your response with [ and end with ].

Format:
[{"goalId":"EXACT_ID_FROM_ABOVE","goalTitle":"exact title","percentProgress":10,"note":"what they said"}]

Rules:
- Use the EXACT goalId string from the brackets above (copy it character-for-character).
- Only include goals explicitly mentioned or clearly implied.
- percentProgress is a number 0-100 representing today's completion of that goal.
- Example: "did 5 pushups" toward a "50 pushups per day" goal → percentProgress: 10
- Do not decrease existing progress unless the user explicitly says they failed.
- If no goal is clearly mentioned, return: []`;

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildSystemPrompt(),
      cache_control: { type: "ephemeral" },
    } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
  ];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemBlocks,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildStaticContextBlock(ctx),
            cache_control: { type: "ephemeral" },
          } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
          { type: "text", text: extractionPrompt },
        ],
      },
    ],
  });

  const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";

  // Strip markdown code fences Claude sometimes adds despite instructions
  const raw = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let updates: ExtractedGoalUpdate[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) updates = parsed;
    else if (parsed && typeof parsed === "object") updates = [parsed];
  } catch (err) {
    // Log so we can see what Claude actually returned
    console.warn("[goal-extract] JSON parse failed. Raw response:", rawText, "Error:", err);
    updates = [];
  }

  console.info("[goal-extract] Extracted updates:", JSON.stringify(updates));

  const today = getDateInTimezone(ctx.user.timezone);

  // Validate each extracted goalId against known goals to catch hallucinated IDs
  const goalMap = new Map(ctx.goals.map((g) => [g.id, g]));
  const validUpdates = updates.filter((u) => {
    if (!goalMap.has(u.goalId)) {
      console.warn("[goal-extract] Claude returned unknown goalId:", u.goalId, "— skipping");
      return false;
    }
    return true;
  });

  for (const update of validUpdates) {
    const goalMeta = goalMap.get(update.goalId);
    const isDaily = goalMeta?.cadence === "daily";

    // Reset-on-first-interaction: stamp the reset date when first progress comes in for the day.
    // This prevents the midnight cron from later wiping progress that was legitimately logged
    // after midnight but before the cron fires.
    const shouldStampReset = isDaily && goalMeta?.lastProgressResetDate !== today;

    console.info("[goal-extract] Writing progress:", update.goalId, update.percentProgress + "%");
    await db
      .update(goalsTable)
      .set({
        progress: update.percentProgress,
        lastCheckedAt: new Date(),
        ...(shouldStampReset ? { lastProgressResetDate: today } : {}),
      })
      .where(and(eq(goalsTable.id, update.goalId), eq(goalsTable.userId, ctx.user.id)));

    if (isDaily && update.percentProgress >= 100) {
      try {
        await updateStreakForGoal(update.goalId, ctx.user.id, update.goalTitle, update.percentProgress, ctx.user.timezone);
      } catch (err) {
        console.warn("[goal-extract] Streak update failed for goal", update.goalId, err);
      }
    }
  }

  // Use validUpdates going forward
  updates = validUpdates;

  if (updates.length > 0) {
    const [existingLog] = await db
      .select()
      .from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.userId, ctx.user.id), eq(dailyLogsTable.logDate, today)));

    const logEntry = {
      goalUpdates: updates,
      midDayMessage: userMessage,
      midDayTimestamp: new Date().toISOString(),
    };

    if (existingLog) {
      const existing = (existingLog.data as Record<string, unknown> | null) ?? {};
      await db
        .update(dailyLogsTable)
        .set({ data: { ...existing, ...logEntry } })
        .where(eq(dailyLogsTable.id, existingLog.id));
    } else {
      await db.insert(dailyLogsTable).values({
        id: nanoid(),
        userId: ctx.user.id,
        logDate: today,
        data: logEntry,
        narrative: null,
      });
    }
  }

  logger.info(
    { userId: ctx.user.id, savedCount: updates.length, goalIds: updates.map((u) => u.goalId) },
    "Goal progress extraction complete",
  );

  return {
    updates,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheHitTokens: getCacheHitTokens(response.usage),
  };
}

export async function runCheckIn(
  ctx: UserContext,
  userMessage: string,
  intent: MessageIntent,
): Promise<CheckInResult> {
  if (intent === "off_topic") {
    return {
      response: OFF_TOPIC_REPLY,
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
    };
  }

  const { budget } = await loadFreshBudget(ctx.user.id);
  if (!budget.allowed) {
    return {
      response: budget.reason ?? "Daily message limit reached.",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
    };
  }

  let extractionInputTokens = 0;
  let extractionOutputTokens = 0;
  let extractionCacheHitTokens = 0;
  let savedUpdates: ExtractedGoalUpdate[] = [];

  if (intent === "goal_update") {
    const extracted = await extractAndSaveGoalProgress(ctx, userMessage);
    savedUpdates = extracted.updates;
    extractionInputTokens = extracted.inputTokens;
    extractionOutputTokens = extracted.outputTokens;
    extractionCacheHitTokens = extracted.cacheHitTokens;

    if (savedUpdates.length === 0 && ctx.goals.length > 0) {
      const goalList = ctx.goals.map((g) => `  - ${g.title}`).join("\n");
      return {
        response: `I could not match that to any of your active goals. Your current goals are:\n${goalList}\n\nWhich one were you updating, and what progress did you make?`,
        inputTokens: extractionInputTokens,
        outputTokens: extractionOutputTokens,
        cacheHitTokens: extractionCacheHitTokens,
      };
    }

    if (savedUpdates.length === 0 && ctx.goals.length === 0) {
      return {
        response: "You do not have any active goals set up yet. Head to the dashboard to create your first goal, then come back and tell me about your progress.",
        inputTokens: 0,
        outputTokens: 0,
        cacheHitTokens: 0,
      };
    }
  }

  const systemPrompt = buildSystemPrompt();
  const staticContextBlock = buildStaticContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  // When a goal_update intent matched no active goals, reply directly without a
  // second AI call. Tell the user nothing was saved and list their active goals
  // so they can rephrase.
  if (intent === "goal_update" && savedUpdates.length === 0) {
    let noMatchReply: string;
    if (ctx.goals.length === 0) {
      noMatchReply =
        "I couldn't find any active goals to log that against. Add a goal first and then send your update.";
    } else {
      const goalList = ctx.goals.map((g) => `- ${g.title}`).join("\n");
      noMatchReply = `I wasn't able to match that to any of your active goals, so nothing was saved.\n\nYour active goals are:\n${goalList}\n\nCould you rephrase your update mentioning one of these goals?`;
    }
    return {
      response: noMatchReply,
      inputTokens: extractionInputTokens,
      outputTokens: extractionOutputTokens,
      cacheHitTokens: extractionCacheHitTokens,
    };
  }

  let instructionSuffix: string;
  if (intent === "goal_update" && savedUpdates.length > 0) {
    const updateSummary = savedUpdates
      .map((u) => {
        const remaining = Math.max(0, 100 - u.percentProgress);
        return `${u.goalTitle}: ${u.percentProgress}% done today (${remaining}% remaining)`;
      })
      .join(", ");
    instructionSuffix = `The user reported goal progress. Progress has been saved: ${updateSummary}. Use the goal title to calculate concrete numbers remaining (e.g. if a '50 pushups' goal is 30% done, tell them they have 35 left). Acknowledge what they accomplished and state exactly how much is left. Keep your response to 2-3 sentences. Plain text only, no markdown, no emojis.`;
  } else {
    instructionSuffix =
      "The user is checking in mid-day. Use the goal progress data above to answer precisely. If they ask how much is left for a goal, calculate it from the 'Progress today' percentage and the numeric target in the goal title (e.g. 70% remaining of a '50 pushups per day' goal = 35 pushups left). Be specific with numbers. Keep your response to 2-3 sentences. Plain text only, no markdown.";
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: staticContextBlock,
          cache_control: { type: "ephemeral" },
        } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: recentLogsBlock,
        },
        {
          type: "text",
          text: `User message: "${userMessage}"\n\n${instructionSuffix}`,
        },
      ],
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
    ],
    messages,
  });

  const responseText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return {
    response: responseText,
    inputTokens: extractionInputTokens + response.usage.input_tokens,
    outputTokens: extractionOutputTokens + response.usage.output_tokens,
    cacheHitTokens: extractionCacheHitTokens + getCacheHitTokens(response.usage),
  };
}
