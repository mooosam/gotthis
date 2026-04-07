import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  buildSystemPrompt,
  buildStaticContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";
import { loadFreshBudget } from "./usage.js";
import type { MessageIntent } from "./classifier.js";

export const OFF_TOPIC_REPLY =
  "I'm your goal coach — let's focus on your targets.";

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

  const systemPrompt = buildSystemPrompt();
  const staticContextBlock = buildStaticContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  let instructionSuffix: string;
  if (intent === "goal_update") {
    instructionSuffix =
      "The user is sharing a goal update or progress report. Acknowledge what they accomplished specifically, ask one focused follow-up question if needed, and encourage the next step. Keep your response to 3 sentences.";
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
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheHitTokens:
      (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
  };
}
