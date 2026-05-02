import cron from "node-cron";
import { db, usersTable, goalsTable } from "@workspace/db";
import { eq, and, ne, or, isNull } from "drizzle-orm";
import { logger } from "../logger.js";

function localDateInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
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

export async function resetDailyGoalsForUser(userId: string, todayLocal: string): Promise<number> {
  const result = await db
    .update(goalsTable)
    .set({ progress: 0, lastProgressResetDate: todayLocal })
    .where(
      and(
        eq(goalsTable.userId, userId),
        eq(goalsTable.cadence, "daily"),
        ne(goalsTable.status, "archived"),
        ne(goalsTable.status, "completed"),
        or(
          isNull(goalsTable.lastProgressResetDate),
          ne(goalsTable.lastProgressResetDate, todayLocal),
        ),
      ),
    )
    .returning({ id: goalsTable.id });

  return result.length;
}

export function startDailyResetCron(): void {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const users = await db
        .select({ id: usersTable.id, timezone: usersTable.timezone })
        .from(usersTable);

      for (const user of users) {
        if (!isMidnightWindowInTimezone(user.timezone)) continue;

        const todayLocal = localDateInTimezone(user.timezone);
        const resetCount = await resetDailyGoalsForUser(user.id, todayLocal);

        if (resetCount > 0) {
          logger.info(
            { userId: user.id, timezone: user.timezone, date: todayLocal, resetCount },
            "Daily goal progress reset at midnight",
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "Daily progress reset cron failed");
    }
  });

  logger.info("Daily goal progress reset cron started (checks every 15 min, fires in 00:00-00:14 local time window)");
}
