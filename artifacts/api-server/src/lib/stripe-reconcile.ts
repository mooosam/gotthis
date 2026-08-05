/**
 * Stripe subscription reconciliation — runs once daily.
 *
 * Problem: if Stripe fails to deliver a webhook (network blip, server restart,
 * etc.) the user's tier in the DB can drift from their actual Stripe state.
 * Stripe retries for 72 hours then stops — after that the drift is permanent
 * without this job.
 *
 * What this does:
 *   - Finds all users whose DB tier is not "free" and who have a stripeSubscriptionId.
 *   - Fetches the subscription from Stripe.
 *   - If Stripe says the subscription is canceled/past_due/unpaid → downgrades to free.
 *   - Logs any drift found so it can be audited.
 *
 * Does NOT upgrade users — upgrades only happen via the checkout webhook so we
 * don't accidentally up-tier someone whose subscription is in a grace period.
 */

import cron from "node-cron";
import { db, usersTable } from "@workspace/db";
import { ne, isNotNull, and } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";
import { getTierConfig } from "./tierConfig.js";
import { logger } from "./logger.js";

const DOWNGRADE_STATUSES = new Set([
  "canceled",
  "unpaid",
  "past_due",
  "incomplete_expired",
]);

async function reconcileOnce(): Promise<void> {
  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    // Stripe not configured — skip silently.
    return;
  }

  const paidUsers = await db
    .select({
      id: usersTable.id,
      tier: usersTable.tier,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
    })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.tier, "free"),
        isNotNull(usersTable.stripeSubscriptionId),
      ),
    );

  if (paidUsers.length === 0) return;

  logger.info({ count: paidUsers.length }, "Stripe reconciliation: checking subscriptions");

  let downgrades = 0;

  for (const user of paidUsers) {
    if (!user.stripeSubscriptionId) continue;
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      if (DOWNGRADE_STATUSES.has(sub.status)) {
        const cfg = getTierConfig("free");
        await db
          .update(usersTable)
          .set({
            tier: "free",
            stripeSubscriptionId: null,
            dailyMessageCap: cfg.dailyMessageCap,
            monthlyTokenAllowance: cfg.monthlyTokenAllowance,
            monthlySkipCredits: cfg.monthlySkipCredits,
          })
          .where(eq(usersTable.id, user.id));

        logger.warn(
          {
            userId: user.id,
            previousTier: user.tier,
            subscriptionId: user.stripeSubscriptionId,
            stripeStatus: sub.status,
          },
          "Stripe reconciliation: downgraded user to free — subscription not active",
        );
        downgrades++;
      }
    } catch (err) {
      // Log and continue — don't let one bad lookup abort the whole run.
      logger.error(
        { err, userId: user.id, subscriptionId: user.stripeSubscriptionId },
        "Stripe reconciliation: failed to retrieve subscription",
      );
    }
  }

  logger.info(
    { checked: paidUsers.length, downgrades },
    "Stripe reconciliation complete",
  );
}

/** Schedule daily reconciliation at 03:00 UTC. */
export function startStripeReconcileCron(): void {
  cron.schedule("0 3 * * *", async () => {
    try {
      await reconcileOnce();
    } catch (err) {
      logger.error({ err }, "Stripe reconciliation cron failed");
    }
  });

  logger.info("Stripe subscription reconciliation cron started (daily at 03:00 UTC)");
}
