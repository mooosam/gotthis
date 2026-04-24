import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, dailyLogsTable, memorySummariesTable, goalsTable, usersTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface MemorySummaryShape {
  personality: string;
  mainThemes: string[];
  recentWins: string[];
  recurringChallenges: string[];
  goalProgress: Array<{ title: string; progress: number; trend: string }>;
  lastUpdated: string;
}

export interface RefreshMemoryResult {
  summary: MemorySummaryShape;
  inputTokens: number;
  outputTokens: number;
}

export async function refreshMemorySummary(userId: string): Promise<RefreshMemoryResult> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const recentLogs = await db
    .select({
      logDate: dailyLogsTable.logDate,
      data: dailyLogsTable.data,
      narrative: dailyLogsTable.narrative,
    })
    .from(dailyLogsTable)
    .where(
      and(
        eq(dailyLogsTable.userId, userId),
        gte(dailyLogsTable.logDate, sevenDaysAgoStr),
      ),
    )
    .orderBy(desc(dailyLogsTable.logDate));

  const goals = await db
    .select({
      title: goalsTable.title,
      category: goalsTable.category,
      status: goalsTable.status,
      progress: goalsTable.progress,
      currentStreak: goalsTable.currentStreak,
    })
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId));

  const logsText = recentLogs.length > 0
    ? recentLogs
        .map((l) => `Date: ${l.logDate}\nNarrative: ${l.narrative ?? "none"}\nData: ${JSON.stringify(l.data)}`)
        .join("\n---\n")
    : "No recent logs available.";

  const goalsText = goals.length > 0
    ? goals.map((g) => `${g.title} (${g.category}) — ${g.progress}% — ${g.status} — streak: ${g.currentStreak}`).join("\n")
    : "No goals recorded.";

  const prompt = `You are a memory consolidation system for a goal coaching app. Based on the user's recent activity logs and goals, produce a JSON memory summary. Be specific and grounded in the data.

RECENT LOGS (last 7 days):
${logsText}

GOALS:
${goalsText}

Respond with ONLY a JSON object in this exact shape (no markdown, no explanation):
{
  "personality": "brief description of user's work style and motivation patterns",
  "mainThemes": ["up to 3 key themes in their goals"],
  "recentWins": ["specific accomplishments from the logs"],
  "recurringChallenges": ["patterns of difficulty or missed goals"],
  "goalProgress": [{"title": "goal title", "progress": 0, "trend": "improving|stable|declining"}],
  "lastUpdated": "${new Date().toISOString().split("T")[0]}"
}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";

  let summary: MemorySummaryShape;
  try {
    summary = JSON.parse(rawText) as MemorySummaryShape;
  } catch {
    summary = {
      personality: "Insufficient data to summarize.",
      mainThemes: [],
      recentWins: [],
      recurringChallenges: [],
      goalProgress: [],
      lastUpdated: new Date().toISOString().split("T")[0],
    };
  }

  const [existing] = await db
    .select()
    .from(memorySummariesTable)
    .where(eq(memorySummariesTable.userId, userId));

  if (existing) {
    await db
      .update(memorySummariesTable)
      .set({ summary })
      .where(eq(memorySummariesTable.id, existing.id));
  } else {
    await db.insert(memorySummariesTable).values({
      id: nanoid(),
      userId,
      summary,
    });
  }

  return { summary, inputTokens, outputTokens };
}
