import cron from "node-cron";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  db,
  usersTable,
  goalsTable,
  dailyLogsTable,
} from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { getTierConfig } from "../tierConfig.js";
import { logger } from "../logger.js";
import { sendNewsletter } from "./service.js";

function localDateInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function localDayOfWeekInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const day = formatter.format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
  } catch {
    return new Date().getDay();
  }
}

function localDayOfMonthInTimezone(timezone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric" }).format(new Date()),
      10,
    );
  } catch {
    return new Date().getDate();
  }
}

async function buildNewsletterNarrative(
  userId: string,
  lookbackDays: number,
): Promise<string> {
  const goals = await db
    .select({
      title: goalsTable.title,
      category: goalsTable.category,
      progress: goalsTable.progress,
      currentStreak: goalsTable.currentStreak,
      successCriteria: goalsTable.successCriteria,
    })
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const logs = await db
    .select({
      logDate: dailyLogsTable.logDate,
      narrative: dailyLogsTable.narrative,
      data: dailyLogsTable.data,
    })
    .from(dailyLogsTable)
    .where(
      and(
        eq(dailyLogsTable.userId, userId),
        gte(dailyLogsTable.logDate, cutoffStr),
      ),
    );

  if (goals.length === 0 && logs.length === 0) {
    return "You have not set up any active goals yet. Log into your dashboard to get started.";
  }

  const goalsBlock =
    goals.length > 0
      ? goals
          .map(
            (g) =>
              `- ${g.title} (${g.category}): ${g.progress}% progress, ${g.currentStreak} day streak${g.successCriteria ? `, target: ${g.successCriteria}` : ""}`,
          )
          .join("\n")
      : "No active goals.";

  const logsBlock =
    logs.length > 0
      ? logs
          .map((l) => `${l.logDate}: ${l.narrative ?? JSON.stringify(l.data) ?? "logged"}`)
          .join("\n")
      : "No log entries this period.";

  const prompt = `You are The Ritual AI, a focused goal coaching assistant. Write a concise weekly progress narrative for a user. Use a warm but direct tone. No hollow praise. No emojis. 3-4 paragraphs max.

ACTIVE GOALS:
${goalsBlock}

LOG ENTRIES (last ${lookbackDays} days):
${logsBlock}

Write the progress narrative now. End with one specific, actionable next step for the coming week.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0]?.type === "text"
    ? response.content[0].text
    : "Your progress summary is not available this week.";
}

function buildPeriodLabel(cadence: string, timezone: string): string {
  const today = localDateInTimezone(timezone);
  if (cadence === "monthly") {
    const [year, month] = today.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return `week of ${today}`;
}

async function sendNewsletterForUser(user: {
  id: string;
  email: string;
  timezone: string;
  newsletterCadence: string;
  lastNewsletterSentAt: Date | null;
}): Promise<void> {
  const lookbackDays = user.newsletterCadence === "monthly" ? 30 : 7;
  const todayLocal = localDateInTimezone(user.timezone);

  const alreadySent =
    user.lastNewsletterSentAt !== null &&
    new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(
      user.lastNewsletterSentAt,
    ) === todayLocal;

  if (alreadySent) return;

  try {
    const narrative = await buildNewsletterNarrative(user.id, lookbackDays);
    const period = buildPeriodLabel(user.newsletterCadence, user.timezone);

    await sendNewsletter({
      userId: user.id,
      toEmail: user.email,
      userName: "",
      period,
      narrative,
    });

    await db
      .update(usersTable)
      .set({ lastNewsletterSentAt: new Date() })
      .where(eq(usersTable.id, user.id));

    logger.info({ userId: user.id, cadence: user.newsletterCadence }, "Newsletter sent");
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send newsletter for user");
  }
}

function isSendTimeForCadence(cadence: string, timezone: string): boolean {
  if (cadence === "weekly") {
    return localDayOfWeekInTimezone(timezone) === 1;
  }
  if (cadence === "monthly") {
    return localDayOfMonthInTimezone(timezone) === 1;
  }
  return false;
}

export function startNewsletterCron(): void {
  cron.schedule("0 8 * * *", async () => {
    logger.info("Newsletter cron fired");

    try {
      const users = await db
        .select({
          id: usersTable.id,
          tier: usersTable.tier,
          email: usersTable.email,
          timezone: usersTable.timezone,
          newsletterCadence: usersTable.newsletterCadence,
          lastNewsletterSentAt: usersTable.lastNewsletterSentAt,
          onboardingCompleted: usersTable.onboardingCompleted,
        })
        .from(usersTable)
        .where(eq(usersTable.onboardingCompleted, true));

      for (const user of users) {
        if (!isSendTimeForCadence(user.newsletterCadence, user.timezone)) continue;

        // Email newsletters are a proactive nudge — require Pro or Elite.
        const tierCfg = getTierConfig(user.tier);
        if (!tierCfg.emailChannel) {
          logger.debug({ userId: user.id, tier: user.tier }, "Skipping newsletter — tier does not include email channel");
          continue;
        }

        await sendNewsletterForUser(user);
      }
    } catch (err) {
      logger.error({ err }, "Newsletter cron failed");
    }
  });

  logger.info("Newsletter cron started (runs daily at 08:00 UTC, sends on Monday for weekly / 1st for monthly)");
}
