/**
 * Periodic cleanup of stale data that accumulates without TTL enforcement.
 *
 * Currently handles:
 *   - Expired magic links (> 7 days old)
 *
 * Runs once at startup and then every 24 hours.
 */

import cron from "node-cron";
import { db, magicLinksTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger.js";

async function cleanupExpiredMagicLinks(): Promise<void> {
  const now = new Date();
  const result = await db
    .delete(magicLinksTable)
    .where(lt(magicLinksTable.expiresAt, now));

  const deleted = (result as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
  if (deleted > 0) {
    logger.info({ deleted }, "Pruned expired magic links");
  }
}

export function startCleanupCron(): void {
  // Run once at startup to clear any backlog.
  cleanupExpiredMagicLinks().catch((err) =>
    logger.warn({ err }, "Initial magic link cleanup failed"),
  );

  // Then once per day at 04:00 UTC.
  cron.schedule("0 4 * * *", async () => {
    try {
      await cleanupExpiredMagicLinks();
    } catch (err) {
      logger.error({ err }, "Magic link cleanup cron failed");
    }
  });

  logger.info("Cleanup cron started (daily at 04:00 UTC)");
}
