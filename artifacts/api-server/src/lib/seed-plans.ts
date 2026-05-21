// Idempotent seed for the default subscription plans. Runs once at server boot;
// inserts the three baseline tiers if they don't already exist so the admin
// dashboard always has data to manage out of the box.

import { db, plansTable } from "@workspace/db";
import { logger } from "./logger.js";

const DEFAULT_PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "Get started with basic goal coaching.",
    dailyMessageCap: 5,
    monthlyTokenAllowance: 50_000,
    monthlySkipCredits: 4,
    priceCents: 0,
    billingPeriod: "monthly" as const,
    sortOrder: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Higher daily message cap and more AI coaching.",
    dailyMessageCap: 50,
    monthlyTokenAllowance: 500_000,
    monthlySkipCredits: 10,
    priceCents: 1_200,
    billingPeriod: "monthly" as const,
    sortOrder: 1,
  },
  {
    slug: "elite",
    name: "Elite",
    description: "Unlimited-feel coaching for committed users.",
    dailyMessageCap: 200,
    monthlyTokenAllowance: 2_000_000,
    monthlySkipCredits: 30,
    priceCents: 2_900,
    billingPeriod: "monthly" as const,
    sortOrder: 2,
  },
];

export async function seedDefaultPlans(): Promise<void> {
  try {
    await db.insert(plansTable).values(DEFAULT_PLANS).onConflictDoNothing();
    logger.info("Default plans seeded (idempotent)");
  } catch (err) {
    logger.warn({ err }, "Default plan seed failed");
  }
}
