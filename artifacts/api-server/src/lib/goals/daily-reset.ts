import cron from "node-cron";
import { db, usersTable, goalsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "../logger.js";

export type RecurringCadence = "daily" | "weekly" | "monthly";

export function localDateInTimezone(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  } catch {
    return now.toISOString().split("T")[0];
  }
}

function localWeekdayInTimezone(timezone: string, now = new Date()): number {
  try {
    const label = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
  } catch {
    return now.getUTCDay();
  }
}

export function getCadencePeriodKey(cadence: string, timezone: string, now = new Date()): string | null {
  const localDate = localDateInTimezone(timezone, now);
  if (cadence === "daily") return localDate;
  if (cadence === "monthly") return `${localDate.slice(0, 7)}-01`;
  if (cadence === "weekly") {
    const weekday = localWeekdayInTimezone(timezone, now);
    const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
    const [year, month, day] = localDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function isMidnightWindowInTimezone(timezone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "1", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "30", 10);
    return hour === 0 && minute < 15;
  } catch {
    return false;
  }
}

export async function resetRecurringGoalsForUser(userId: string, timezone: string): Promise<number> {
  let total = 0;
  for (const cadence of ["daily", "weekly", "monthly"] as const) {
    const periodKey = getCadencePeriodKey(cadence, timezone);
    if (!periodKey) continue;

    const candidates = await db
      .select({ id: goalsTable.id, lastProgressResetDate: goalsTable.lastProgressResetDate })
      .from(goalsTable)
      .where(and(
        eq(goalsTable.userId, userId),
        eq(goalsTable.cadence, cadence),
        ne(goalsTable.status, "archived"),
        ne(goalsTable.status, "completed"),
      ));

    const due = candidates.filter((goal) => goal.lastProgressResetDate !== periodKey);
    for (const goal of due) {
      await db
        .update(goalsTable)
        .set({ progress: 0, currentValue: 0, lastProgressResetDate: periodKey })
        .where(eq(goalsTable.id, goal.id));
    }
    total += due.length;
  }
  return total;
}

// Backward-compatible export used by any older callers/tests.
export async function resetDailyGoalsForUser(userId: string, todayLocal: string): Promise<number> {
  const candidates = await db
    .select({ id: goalsTable.id, lastProgressResetDate: goalsTable.lastProgressResetDate })
    .from(goalsTable)
    .where(and(
      eq(goalsTable.userId, userId),
      eq(goalsTable.cadence, "daily"),
      ne(goalsTable.status, "archived"),
      ne(goalsTable.status, "completed"),
    ));
  const due = candidates.filter((goal) => goal.lastProgressResetDate !== todayLocal);
  for (const goal of due) {
    await db.update(goalsTable).set({ progress: 0, currentValue: 0, lastProgressResetDate: todayLocal }).where(eq(goalsTable.id, goal.id));
  }
  return due.length;
}

export function startDailyResetCron(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const users = await db.select({ id: usersTable.id, timezone: usersTable.timezone }).from(usersTable);
      for (const user of users) {
        if (!isMidnightWindowInTimezone(user.timezone)) continue;
        const resetCount = await resetRecurringGoalsForUser(user.id, user.timezone);
        if (resetCount > 0) {
          logger.info(
            { userId: user.id, timezone: user.timezone, date: localDateInTimezone(user.timezone), resetCount },
            "Recurring goal progress reset for new local period",
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "Recurring progress reset cron failed");
    }
  });

  logger.info("Recurring goal reset cron started (daily/weekly/monthly; checks every 15 min in local midnight window)");
}
