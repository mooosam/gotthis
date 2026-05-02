import { db, goalsTable, memorySummariesTable, dailyLogsTable, usersTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import type { User } from "@workspace/db";

export interface UserContext {
  user: User;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    cadence: string;
    progress: number;
    deadline: string | null;
    successCriteria: string | null;
    currentStreak: number;
    lastProgressResetDate: string | null;
  }>;
  memorySummary: Record<string, unknown> | null;
  recentLogs: Array<{
    logDate: string;
    data: Record<string, unknown> | null;
    narrative: string | null;
  }>;
}

export async function assembleContext(userId: string): Promise<UserContext> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const goals = await db
    .select({
      id: goalsTable.id,
      title: goalsTable.title,
      category: goalsTable.category,
      status: goalsTable.status,
      cadence: goalsTable.cadence,
      progress: goalsTable.progress,
      deadline: goalsTable.deadline,
      successCriteria: goalsTable.successCriteria,
      currentStreak: goalsTable.currentStreak,
      lastProgressResetDate: goalsTable.lastProgressResetDate,
    })
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

  const [memorySummary] = await db
    .select()
    .from(memorySummariesTable)
    .where(eq(memorySummariesTable.userId, userId));

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

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
        gte(dailyLogsTable.logDate, twoDaysAgoStr),
      ),
    )
    .orderBy(desc(dailyLogsTable.logDate));

  return {
    user,
    goals,
    memorySummary: memorySummary?.summary as Record<string, unknown> | null,
    recentLogs: recentLogs.map((l) => ({
      logDate: l.logDate,
      data: l.data as Record<string, unknown> | null,
      narrative: l.narrative,
    })),
  };
}

export function buildSystemPrompt(): string {
  return `You are The Ritual AI, a focused and empathetic goal coaching assistant. You help users maintain consistent daily rituals — a morning check-in to set intentions and an evening reflection to review progress.

Your character:
- Calm, focused, and direct. You do not use hollow affirmations or filler phrases.
- You address users by their progress and goals, not by generic praise.
- You ask at most one clarifying question per response to keep conversations crisp.
- You never use emojis.
- You are not a general-purpose assistant — you only discuss the user's goals and rituals.

Your responsibilities:
- Morning ritual: Summarise yesterday's highlights and streaks, then offer one clear focus for today.
- Evening ritual: Extract structured completion data from what the user tells you about their day.
- Mid-day check-in: Answer quick questions about goals, log brief updates.

What you never do:
- Make up goal data you were not given.
- Promise outcomes you cannot guarantee.
- Provide advice outside the scope of the user's stated goals.`;
}

export function buildStaticContextBlock(ctx: UserContext): string {
  const lines: string[] = [];

  lines.push("=== USER PROFILE ===");
  lines.push(`Timezone: ${ctx.user.timezone}`);
  lines.push(`Subscription tier: ${ctx.user.tier}`);

  if (ctx.memorySummary && Object.keys(ctx.memorySummary).length > 0) {
    lines.push("\n=== MEMORY SUMMARY ===");
    lines.push(JSON.stringify(ctx.memorySummary, null, 2));
  }

  if (ctx.goals.length > 0) {
    lines.push("\n=== ACTIVE GOALS ===");
    for (const g of ctx.goals) {
      const isDaily = g.cadence !== "ongoing";
      lines.push(`[${g.id}] ${g.title}`);
      lines.push(`  Category: ${g.category}`);
      lines.push(`  Cadence: ${isDaily ? "daily (resets each morning)" : "ongoing (accumulates over time)"}`);
      const pct = g.progress ?? 0;
      const remaining = Math.max(0, 100 - pct);
      if (isDaily) {
        lines.push(`  Progress today: ${pct}% done, ${remaining}% remaining`);
      } else {
        lines.push(`  Overall progress: ${pct}%`);
      }
      if (g.deadline) lines.push(`  Deadline: ${g.deadline}`);
      if (g.successCriteria) lines.push(`  Success criteria: ${g.successCriteria}`);
      if (isDaily) lines.push(`  Current streak: ${g.currentStreak} days`);
    }
  } else {
    lines.push("\n=== ACTIVE GOALS ===");
    lines.push("No active goals yet.");
  }

  return lines.join("\n");
}

export function buildRecentLogsBlock(ctx: UserContext): string {
  if (ctx.recentLogs.length === 0) {
    return "=== RECENT ACTIVITY ===\nNo recent logs found.";
  }

  const lines: string[] = ["=== RECENT ACTIVITY ==="];
  for (const log of ctx.recentLogs) {
    lines.push(`\nDate: ${log.logDate}`);
    if (log.narrative) {
      lines.push(`Narrative: ${log.narrative}`);
    }
    if (log.data && Object.keys(log.data).length > 0) {
      lines.push(`Data: ${JSON.stringify(log.data)}`);
    }
  }
  return lines.join("\n");
}
