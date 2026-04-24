import cron from "node-cron";
import { db, usersTable, goalsTable, dailyLogsTable } from "@workspace/db";
import { eq, and, gte, ne, isNotNull } from "drizzle-orm";
import { logger } from "../logger.js";

interface GoalUpdate {
  goalId?: string;
  goalTitle?: string;
  percentProgress?: number;
}

interface DailyLogData {
  goalUpdates?: GoalUpdate[];
}

function buildQuickChartUrl(labels: string[], data: number[]): string {
  const config = {
    type: "bar",
    data: {
      labels: labels.map((l) => (l.length > 20 ? l.slice(0, 20) + "..." : l)),
      datasets: [
        {
          label: "Progress (%)",
          data,
          backgroundColor: "rgba(99, 102, 241, 0.7)",
          borderColor: "rgb(99, 102, 241)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: "Progress (%)" } },
      },
      plugins: { title: { display: true, text: "Weekly Goal Progress" } },
    },
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&w=500&h=300&bkg=white`;
}

function isSundayMorningInTimezone(timezone: string): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    return weekday === "Sun" && hour >= 8 && hour < 10;
  } catch {
    return false;
  }
}

async function buildWeeklyChartText(userId: string): Promise<string | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const [activeGoals, recentLogs] = await Promise.all([
    db
      .select({ id: goalsTable.id, title: goalsTable.title, progress: goalsTable.progress })
      .from(goalsTable)
      .where(and(eq(goalsTable.userId, userId), ne(goalsTable.status, "archived"))),
    db
      .select({ data: dailyLogsTable.data })
      .from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.userId, userId), gte(dailyLogsTable.logDate, sevenDaysAgoStr))),
  ]);

  if (activeGoals.length === 0) return null;

  const progressMap = new Map<string, number>(activeGoals.map((g) => [g.id, g.progress]));

  for (const log of recentLogs) {
    const data = log.data as DailyLogData | null;
    for (const update of data?.goalUpdates ?? []) {
      if (update.goalId && update.percentProgress !== undefined) {
        progressMap.set(update.goalId, update.percentProgress);
      }
    }
  }

  const labels = activeGoals.map((g) => g.title);
  const data = activeGoals.map((g) => progressMap.get(g.id) ?? g.progress);

  const chartUrl = buildQuickChartUrl(labels, data);
  return `Your weekly goal snapshot:\n${chartUrl}\n\nHave a great Sunday — keep going.`;
}

function localDateInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function startWeeklyChartCron(
  sendMessage: (jid: string, text: string) => Promise<void>,
): void {
  cron.schedule("0 * * * *", async () => {
    try {
      const users = await db
        .select({
          id: usersTable.id,
          timezone: usersTable.timezone,
          whatsappJid: usersTable.whatsappJid,
          lastWeeklyChartSentAt: usersTable.lastWeeklyChartSentAt,
        })
        .from(usersTable)
        .where(isNotNull(usersTable.whatsappJid));

      for (const user of users) {
        if (!user.whatsappJid || !isSundayMorningInTimezone(user.timezone)) continue;

        const todayLocal = localDateInTimezone(user.timezone);
        const alreadySentToday =
          user.lastWeeklyChartSentAt !== null &&
          new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(
            user.lastWeeklyChartSentAt,
          ) === todayLocal;

        if (alreadySentToday) continue;

        const text = await buildWeeklyChartText(user.id);
        if (!text) continue;

        await sendMessage(user.whatsappJid, text);
        await db
          .update(usersTable)
          .set({ lastWeeklyChartSentAt: new Date() })
          .where(eq(usersTable.id, user.id));

        logger.info({ userId: user.id }, "Sent weekly goal chart via WhatsApp");
      }
    } catch (err) {
      logger.error({ err }, "Weekly chart cron failed");
    }
  });

  logger.info("Weekly goal chart cron started (checks hourly, fires on Sunday 8-10am local time)");
}
