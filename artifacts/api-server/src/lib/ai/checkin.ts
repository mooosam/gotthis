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

Their active goals:
${goalListText}

Extract which goal(s) they mentioned and estimate their updated progress percentage. Respond with ONLY a JSON array (no markdown):
[
  {
    "goalId": "goal-id-string",
    "goalTitle": "goal title",
    "percentProgress": 10,
    "note": "brief note of what they said"
  }
]

Rules:
- Only include goals explicitly mentioned or clearly implied.
- Set percentProgress based on what they described relative to their goal's success criteria.
- If they said they "did 5 pushups" toward a "50 pushups daily" goal, that is 10% for today's task.
- Do not decrease existing progress unless they say they failed.
- If no goal is mentioned, return an empty array: []`;

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

  const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";

  let updates: ExtractedGoalUpdate[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) updates = parsed;
  } catch {
    updates = [];
  }

  const today = getTodayDate();

  for (const update of updates) {
    await db
      .update(goalsTable)
      .set({ progress: update.percentProgress, lastCheckedAt: new Date() })
      .where(and(eq(goalsTable.id, update.goalId), eq(goalsTable.userId, ctx.user.id)));
  }

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
  }

  const systemPrompt = buildSystemPrompt();
  const staticContextBlock = buildStaticContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  let instructionSuffix: string;
  if (intent === "goal_update" && savedUpdates.length > 0) {
    const updateSummary = savedUpdates
      .map((u) => `${u.goalTitle}: ${u.percentProgress}% progress logged`)
      .join(", ");
    instructionSuffix = `The user reported goal progress. Progress has been saved: ${updateSummary}. Acknowledge what they accomplished specifically and encourage their next step. Keep your response to 2-3 sentences. Plain text only, no markdown, no emojis.`;
  } else if (intent === "goal_update") {
    instructionSuffix =
      "The user is sharing a goal update. Acknowledge what they said and ask a focused follow-up about which goal they are working on. Keep your response to 3 sentences. Plain text only.";
  } else {
    instructionSuffix =
      "The user is checking in mid-day. Respond helpfully and briefly in the context of their goals. Keep your response to 3-4 sentences. Plain text only.";
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
