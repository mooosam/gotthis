import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, magicLinksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  buildSystemPrompt,
  buildStaticContextBlock,
  buildRecentLogsBlock,
  type UserContext,
} from "./context.js";
import { loadFreshBudget, getCacheHitTokens } from "./usage.js";
import { getActiveMilestone } from "./streaks.js";

export interface MorningRitualResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}

async function createMagicLink(userId: string, targetDate: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(magicLinksTable).values({
    id: nanoid(),
    userId,
    token,
    targetDate,
    targetGoalId: null,
    expiresAt,
  });

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";

  return `${baseUrl}/review/${targetDate}?token=${token}`;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export async function runMorningRitual(
  ctx: UserContext,
  userMessage: string,
): Promise<MorningRitualResult> {
  const { budget } = await loadFreshBudget(ctx.user.id);
  if (!budget.allowed) {
    return {
      response: budget.reason ?? "Daily message limit reached.",
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
    };
  }

  const yesterday = getYesterdayDate();
  const yesterdayLog = ctx.recentLogs.find((l) => l.logDate === yesterday);
  const magicLinkUrl = await createMagicLink(ctx.user.id, yesterday);

  const systemPrompt = buildSystemPrompt();
  const staticContextBlock = buildStaticContextBlock(ctx);
  const recentLogsBlock = buildRecentLogsBlock(ctx);

  const yesterdayHighlight = yesterdayLog?.narrative
    ? `Yesterday's summary: ${yesterdayLog.narrative}`
    : "No log found for yesterday.";

  const streakLines = ctx.goals
    .filter((g) => g.currentStreak > 0)
    .map((g) => `${g.title}: ${g.currentStreak}-day streak`)
    .join(", ");

  const activeMilestones = await Promise.all(
    ctx.goals.map(async (g) => {
      const milestone = await getActiveMilestone(g.id, ctx.user.id);
      return milestone ? `${g.title} — active milestone: "${milestone.title}" (step ${milestone.order})` : null;
    }),
  );
  const milestoneLines = activeMilestones.filter(Boolean).join("\n");

  const prompt = `Morning ritual triggered. User message: "${userMessage}"

${yesterdayHighlight}
${streakLines ? `Active streaks: ${streakLines}` : "No active streaks."}
${milestoneLines ? `Current milestones:\n${milestoneLines}` : ""}

Write a morning coaching message with exactly 3-4 sentences:
1. One sentence summarising yesterday's highlights (use the data above; if no log, note the fresh start).
2. One sentence on streaks (if any active ones, call them out specifically).
3. If there are active milestones, name the most relevant one as today's specific focus. Otherwise name the single most important goal for today.
4. End with this exact line: "See yesterday's full review here: ${magicLinkUrl}"

Plain text only. No emojis. No markdown. Keep it under 90 words before the link line.`;

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
          text: prompt,
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
    cacheHitTokens: getCacheHitTokens(response.usage),
  };
}
