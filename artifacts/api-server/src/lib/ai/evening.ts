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
import { getTodayDate, loadFreshBudget, checkBudgetForUser, getCacheHitTokens } from "./usage.js";
import { refreshMemorySummary } from "./memory.js";

export interface GoalCompletion {
  goalId: string;
  goalTitle: string;
  percentProgress: number;
  status: "completed" | "partial" | "skipped" | "not_started";
  note: string;
  blocker: string | null;
}

export interface EveningLogData {
  date: string;
  goalUpdates: GoalCompletion[];
  wins: string[];
  blockers: string[];
  overallMood: "positive" | "neutral" | "negative";
  eveningMessage: string;
  eveningTimestamp: string;
}

export interface EveningRitualResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}

export async function runEveningRitual(
  ctx: UserContext,
  userMessage: string,
): Promise<EveningRitualResult> {
  const { budget } = await loadFreshBudget(ctx.user.id);
  if (!budget.allowed) {
    return {
      response: budget.reason ?? "Daily message limit reached.",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
    };
  }

  const systemPrompt = buildSystemPrompt();
  const staticContextBlock = buildStaticContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);
  const today = getTodayDate();

  const goalListText = ctx.goals
    .map((g) => `[${g.id}] ${g.title} (current progress: ${g.progress}%)`)
    .join("\n");

  const extractionPrompt = `Evening ritual triggered. User message: "${userMessage}"

Goals to extract status for:
${goalListText || "No active goals."}

Extract structured completion data from the user's message. Respond with ONLY a JSON object (no markdown, no explanation) in this exact shape:
{
  "goalUpdates": [
    {
      "goalId": "goal-id-string",
      "goalTitle": "goal title",
      "percentProgress": 0,
      "status": "completed|partial|skipped|not_started",
      "note": "what the user said about this goal",
      "blocker": null
    }
  ],
  "wins": ["specific things accomplished today"],
  "blockers": ["things that got in the way"],
  "overallMood": "positive|neutral|negative",
  "narrative": "2-3 sentence third-person summary of today"
}

If the user did not mention a goal, omit it from goalUpdates. Set percentProgress based on what they described — do not change it if they gave no indication.`;

  const extractionMessages: Anthropic.MessageParam[] = [
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
          text: extractionPrompt,
        },
      ],
    },
  ];

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
  ];

  const extractionResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemBlocks,
    messages: extractionMessages,
  });

  const extractionInputTokens = extractionResponse.usage.input_tokens;
  const extractionOutputTokens = extractionResponse.usage.output_tokens;
  const extractionCacheHitTokens = getCacheHitTokens(extractionResponse.usage);

  const extractedText =
    extractionResponse.content[0]?.type === "text"
      ? extractionResponse.content[0].text.trim()
      : "{}";

  let extractedData: {
    goalUpdates?: GoalCompletion[];
    wins?: string[];
    blockers?: string[];
    overallMood?: "positive" | "neutral" | "negative";
    narrative?: string;
  } = {};

  try {
    extractedData = JSON.parse(extractedText);
  } catch {
    extractedData = {};
  }

  const logData: EveningLogData = {
    date: today,
    goalUpdates: extractedData.goalUpdates ?? [],
    wins: extractedData.wins ?? [],
    blockers: extractedData.blockers ?? [],
    overallMood: extractedData.overallMood ?? "neutral",
    eveningMessage: userMessage,
    eveningTimestamp: new Date().toISOString(),
  };

  const narrative = extractedData.narrative ?? "";

  const [existingLog] = await db
    .select()
    .from(dailyLogsTable)
    .where(
      and(
        eq(dailyLogsTable.userId, ctx.user.id),
        eq(dailyLogsTable.logDate, today),
      ),
    );

  if (existingLog) {
    const existingData = (existingLog.data as Record<string, unknown> | null) ?? {};
    await db
      .update(dailyLogsTable)
      .set({ data: { ...existingData, ...logData }, narrative })
      .where(eq(dailyLogsTable.id, existingLog.id));
  } else {
    await db.insert(dailyLogsTable).values({
      id: nanoid(),
      userId: ctx.user.id,
      logDate: today,
      data: logData,
      narrative,
    });
  }

  for (const goalUpdate of logData.goalUpdates) {
    await db
      .update(goalsTable)
      .set({
        progress: goalUpdate.percentProgress,
        lastCheckedAt: new Date(),
      })
      .where(and(eq(goalsTable.id, goalUpdate.goalId), eq(goalsTable.userId, ctx.user.id)));
  }

  // Load a fresh budget snapshot, then adjust for extraction tokens that have been
  // used but not yet persisted (they will be recorded in a single recordUsage call
  // by processor.ts after this handler returns). This ensures the coaching call is
  // only allowed if the user still has headroom after the extraction call.
  const { user: freshUser } = await loadFreshBudget(ctx.user.id);
  const extractionTokensUsed = extractionInputTokens + extractionOutputTokens;
  const adjustedUser = {
    ...freshUser,
    monthlyTokenCount: freshUser.monthlyTokenCount + extractionTokensUsed,
  };
  const budget2 = checkBudgetForUser(adjustedUser);

  if (!budget2.allowed) {
    return {
      response: "Daily log saved. " + (budget2.reason ?? "Token limit reached."),
      inputTokens: extractionInputTokens,
      outputTokens: extractionOutputTokens,
      cacheHitTokens: extractionCacheHitTokens,
    };
  }

  const winsText = logData.wins.length > 0 ? `Wins: ${logData.wins.join("; ")}` : "No wins logged.";
  const blockersText = logData.blockers.length > 0 ? `Blockers: ${logData.blockers.join("; ")}` : "";
  const goalSummary = logData.goalUpdates.length > 0
    ? logData.goalUpdates
        .map((u) => `${u.goalTitle}: ${u.status} (${u.percentProgress}%)`)
        .join(", ")
    : "No goals updated.";

  const coachingPrompt = `Evening ritual data extracted successfully:
${winsText}
${blockersText}
Goal summary: ${goalSummary}

Write a coaching response (2-4 sentences) that:
1. Acknowledges what they accomplished specifically.
2. Names one thing to carry into tomorrow.
3. Closes with something grounded and honest.

Plain text only. No emojis. No markdown.`;

  const coachingMessages: Anthropic.MessageParam[] = [
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
          text: coachingPrompt,
        },
      ],
    },
  ];

  const coachingResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemBlocks,
    messages: coachingMessages,
  });

  const coachingText =
    coachingResponse.content[0]?.type === "text"
      ? coachingResponse.content[0].text
      : "";

  const coachingInputTokens = coachingResponse.usage.input_tokens;
  const coachingOutputTokens = coachingResponse.usage.output_tokens;
  const coachingCacheHitTokens = getCacheHitTokens(coachingResponse.usage);

  let memoryInputTokens = 0;
  let memoryOutputTokens = 0;
  try {
    const memoryResult = await refreshMemorySummary(ctx.user.id);
    memoryInputTokens = memoryResult.inputTokens;
    memoryOutputTokens = memoryResult.outputTokens;
  } catch {
    // Non-fatal: memory refresh failure should not break the response
  }

  return {
    response: coachingText,
    inputTokens: extractionInputTokens + coachingInputTokens + memoryInputTokens,
    outputTokens: extractionOutputTokens + coachingOutputTokens + memoryOutputTokens,
    cacheHitTokens: extractionCacheHitTokens + coachingCacheHitTokens,
  };
}
