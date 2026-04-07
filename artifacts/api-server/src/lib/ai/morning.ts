import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  buildSystemPrompt,
  buildContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";

export interface MorningRitualResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  todayLogData: Record<string, unknown>;
}

export async function runMorningRitual(
  ctx: UserContext,
  userMessage: string,
): Promise<MorningRitualResult> {
  const systemPrompt = buildSystemPrompt();
  const contextBlock = buildContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  const systemMessages: Anthropic.MessageParam["content"] = [
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
          text: `It is morning. The user is starting their morning ritual. Their message: "${userMessage}"\n\nRespond as a morning ritual coach. Briefly acknowledge their start, then guide them to set one or two specific intentions for today based on their active goals. Keep your response concise and actionable — no more than 3-4 sentences.`,
        },
      ],
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemMessages as Anthropic.TextBlockParam[],
    messages,
  });

  const responseText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cacheHitTokens =
    (response.usage as Record<string, number>).cache_read_input_tokens ?? 0;

  const todayLogData: Record<string, unknown> = {
    morningIntention: responseText,
    morningMessage: userMessage,
    morningTimestamp: new Date().toISOString(),
  };

  return {
    response: responseText,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    todayLogData,
  };
}
