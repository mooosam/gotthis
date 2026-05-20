import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsApp, sendToJid } from "./lib/whatsapp/service.js";
import { startWeeklyChartCron } from "./lib/whatsapp/weekly-chart.js";
import { startNewsletterCron } from "./lib/email/newsletter.js";
import { startDailyResetCron } from "./lib/goals/daily-reset.js";
import { seedDefaultPlans } from "./lib/seed-plans.js";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";

// Catch unhandled promise rejections (e.g. from Baileys reconnect timers) so
// they are logged rather than crashing the process in Node 15+.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — keeping process alive");
});

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  try {
    await runMigrations({ databaseUrl, schema: "stripe" });
    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.warn({ err }, "Stripe backfill failed"));
    logger.info("Stripe initialized");
  } catch (err) {
    logger.warn({ err }, "Stripe init skipped — connect the Stripe integration to enable payments");
  }
}

if (process.env.NODE_ENV === "production") {
  const required = ["DATABASE_URL", "CLERK_SECRET_KEY", "PHONE_PEPPER"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} environment variable is required in production but was not provided.`);
    }
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedDefaultPlans().catch((seedErr) => {
    logger.warn({ err: seedErr }, "Plan seed failed");
  });

  startWhatsApp().catch((startErr) => {
    logger.error({ err: startErr }, "WhatsApp service failed to start");
  });

  startWeeklyChartCron(sendToJid);
  startNewsletterCron();
  startDailyResetCron();
});
