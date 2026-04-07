import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, dailyLogsTable, goalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  buildSystemPrompt,
  buildContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";
import { getTodayDate } from "./usage.js";

export interface EveningRitualResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  narrative: string;
}

function extractGoalUpdates(
  responseText: string,
  goals: UserContext["goals"],
): Array<{ goalId: string; note: string }> {
  const updates: Array<{ goalId: string; note: string }> = [];
  for (const goal of goals) {
    const titleLower = goal.title.toLowerCase();
    const responseLower = responseText.toLowerCase();
    if (responseLower.includes(titleLower)) {
      updates.push({ goalId: goal.id, note: "Mentioned in evening ritual" });
    }
  }
  return updates;
}

export async function runEveningRitual(
  ctx: UserContext,
  userMessage: string,
): Promise<EveningRitualResult> {
  const systemPrompt = buildSystemPrompt();
  const contextBlock = buildContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  const systemMessages: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
  ];

  const userContextContent = `${contextBlock}\n\n${recentLogsBlock}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: userContextContent,
          cache_control: { type: "ephemeral" },
        } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `It is evening. The user is completing their evening reflection ritual. Their message: "${userMessage}"\n\nRespond as an evening ritual coach. Guide them through a brief reflection: what they accomplished, what they did not, and one specific intention for tomorrow. Ask about progress on their active goals if they have not mentioned it. Keep your response concise — 4-5 sentences maximum.`,
        },
      ],
    },
  ];

  const reflectionResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemMessages,
    messages,
  });

  const reflectionText =
    reflectionResponse.content[0]?.type === "text"
      ? reflectionResponse.content[0].text
      : "";

  const narrativeMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: reflectionText },
    {
      role: "user",
      content:
        "Based on this evening reflection, write a single concise paragraph (2-3 sentences) that could serve as a narrative summary of today. Write it in third person. Focus on what was accomplished or attempted, and the tone of the day.",
    },
  ];

  const narrativeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemMessages,
    messages: narrativeMessages,
  });

  const narrativeText =
    narrativeResponse.content[0]?.type === "text"
      ? narrativeResponse.content[0].text
      : "";

  const inputTokens =
    reflectionResponse.usage.input_tokens +
    narrativeResponse.usage.input_tokens;
  const outputTokens =
    reflectionResponse.usage.output_tokens +
    narrativeResponse.usage.output_tokens;
  const cacheHitTokens =
    ((reflectionResponse.usage as Record<string, number>).cache_read_input_tokens ?? 0) +
    ((narrativeResponse.usage as Record<string, number>).cache_read_input_tokens ?? 0);

  const today = getTodayDate();

  const goalUpdates = extractGoalUpdates(
    userMessage + " " + reflectionText,
    ctx.goals,
  );

  const logData: Record<string, unknown> = {
    eveningReflection: reflectionText,
    eveningMessage: userMessage,
    eveningTimestamp: new Date().toISOString(),
    goalMentions: goalUpdates,
  };

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
    const existingData =
      (existingLog.data as Record<string, unknown> | null) ?? {};
    await db
      .update(dailyLogsTable)
      .set({
        data: { ...existingData, ...logData },
        narrative: narrativeText,
      })
      .where(eq(dailyLogsTable.id, existingLog.id));
  } else {
    await db.insert(dailyLogsTable).values({
      id: nanoid(),
      userId: ctx.user.id,
      logDate: today,
      data: logData,
      narrative: narrativeText,
    });
  }

  for (const goal of ctx.goals) {
    await db
      .update(goalsTable)
      .set({ lastCheckedAt: new Date() })
      .where(eq(goalsTable.id, goal.id));
  }

  return {
    response: reflectionText,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    narrative: narrativeText,
  };
}
