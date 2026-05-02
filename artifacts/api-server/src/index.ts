import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsApp, sendToJid } from "./lib/whatsapp/service.js";
import { startWeeklyChartCron } from "./lib/whatsapp/weekly-chart.js";
import { startNewsletterCron } from "./lib/email/newsletter.js";
import { startDailyResetCron } from "./lib/goals/daily-reset.js";
import { seedDefaultPlans } from "./lib/seed-plans.js";

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
