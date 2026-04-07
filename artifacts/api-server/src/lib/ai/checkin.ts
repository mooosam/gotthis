import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  buildSystemPrompt,
  buildContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";
import type { MessageIntent } from "./classifier.js";

export interface CheckInResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}

export async function runCheckIn(
  ctx: UserContext,
  userMessage: string,
  intent: MessageIntent,
): Promise<CheckInResult> {
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

  let instructionSuffix: string;

  if (intent === "goal_update") {
    instructionSuffix =
      "The user appears to be sharing a goal update or progress report. Acknowledge what they accomplished specifically, ask one focused follow-up question if needed, and encourage their next step. Keep your response to 3 sentences.";
  } else if (intent === "off_topic") {
    instructionSuffix =
      "The user's message is not directly about their goals or daily ritual. Politely redirect them back to their goals with a brief comment. Keep your response to 1-2 sentences.";
  } else {
    instructionSuffix =
      "The user is checking in mid-day. Respond helpfully and briefly in the context of their goals. Keep your response to 3-4 sentences.";
  }

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
          text: `User message: "${userMessage}"\n\n${instructionSuffix}`,
        },
      ],
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemMessages,
    messages,
  });

  const responseText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cacheHitTokens =
    (response.usage as Record<string, number>).cache_read_input_tokens ?? 0;

  return { response: responseText, inputTokens, outputTokens, cacheHitTokens };
}
