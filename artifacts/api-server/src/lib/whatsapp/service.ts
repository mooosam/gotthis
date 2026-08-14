import crypto from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPhone } from "../phone.js";
import { processMessage } from "../ai/processor.js";
import { createReviewMagicLink, getBaseUrl } from "./magic-link.js";
import { checkBudgetForUser } from "../ai/usage.js";
import { recordInboundEngagement } from "../ai/engagement.js";
import { logger } from "../logger.js";
import type { User } from "@workspace/db";

export type WAStatus = "disconnected" | "open";

// ---------------------------------------------------------------------------
// Bounded TTL cache for message IDs — Meta can redeliver the same webhook
// event on retry (e.g. if we're slow to respond), so we dedupe on message id.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SWEEP_MS = 5 * 60 * 1000; //  5 minutes

const msgCache = new Map<string, number>();

function cacheHas(id: string): boolean {
  const at = msgCache.get(id);
  if (at === undefined) return false;
  if (Date.now() - at > CACHE_TTL_MS) {
    msgCache.delete(id);
    return false;
  }
  return true;
}
function cacheSet(id: string): void {
  msgCache.set(id, Date.now());
}

setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [id, at] of msgCache) {
    if (at < cutoff) msgCache.delete(id);
  }
}, SWEEP_MS).unref();

export function getStatus(): WAStatus {
  const configured = !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_VERIFY_TOKEN
  );
  return configured ? "open" : "disconnected";
}

export function getConnectedPhone(): string | null {
  return process.env.WHATSAPP_DISPLAY_PHONE ?? null;
}

// ---------------------------------------------------------------------------
// Webhook verification (GET handshake) — Meta calls this once when you save
// the Callback URL / Verify Token in the app dashboard.
// ---------------------------------------------------------------------------
export function verifyWebhookChallenge(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
): string | null {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return challenge ?? "";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Webhook signature verification (POST events) — Meta signs every webhook
// delivery with your app secret so you can confirm it's really from Meta.
// ---------------------------------------------------------------------------
export function verifyCloudApiSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader),
    );
  } catch {
    return false;
  }
}

async function findUserByPhone(phone: string): Promise<User | null> {
  const hashed = hashPhone(phone);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phoneHash, hashed));

  if (user && user.whatsappJid !== phone) {
    await db
      .update(usersTable)
      .set({ whatsappJid: phone })
      .where(eq(usersTable.id, user.id));
  }

  return user ?? null;
}

async function sendCloudApiMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    logger.error("WhatsApp Cloud API not configured — cannot send message");
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    logger.error(
      { status: res.status, errBody },
      "Failed to send WhatsApp message via Cloud API",
    );
  }
}

async function sendTracked(to: string, text: string): Promise<void> {
  await sendCloudApiMessage(to, text);
}

export async function sendToJid(to: string, text: string): Promise<void> {
  await sendTracked(to, text);
}

async function handleIncomingMessage(
  phone: string,
  text: string,
): Promise<void> {
  const user = await findUserByPhone(phone);

  if (!user) {
    // Silently ignore messages from numbers with no linked app account.
    return;
  }

  // Handle utility commands before onboarding/budget checks. These commands
  // should always remain available, including when the user has exhausted
  // their AI message allowance.
  const command = text.trim().toLowerCase();
  if (command === "dashboard" || command === "dash") {
    const base = getBaseUrl();
    await sendTracked(
      phone,
      `Here’s your GotThis dashboard:\n\n${base}/dashboard`,
    );
    return;
  }

  if (!user.onboardingCompleted) {
    const base = getBaseUrl();
    await sendTracked(
      phone,
      `Your account is almost ready. Please finish setting up your timezone and goals at ${base}/onboarding — then message me again to start your first ritual.`,
    );
    return;
  }

  const budgetCheck = checkBudgetForUser(user);
  if (!budgetCheck.allowed) {
    const base = getBaseUrl();
    const upgradeHint = budgetCheck.upgradePrompt
      ? `\n\n👉 Upgrade now: ${base}/pricing`
      : "";
    await sendTracked(
      phone,
      (budgetCheck.reason ?? "Daily message limit reached.") + upgradeHint,
    );
    return;
  }

  try {
    await recordInboundEngagement(user.id);
  } catch (engagementErr) {
    logger.warn({ err: engagementErr }, "Failed to record engagement sample");
  }

  const result = await processMessage(user.id, text);

  logger.info(
    { phone: phone.slice(-4) + "****", intent: result.intent },
    "WhatsApp message processed",
  );

  const today = new Date().toISOString().split("T")[0];
  let reply = result.reply;

  if (
    result.intent === "morning_ritual" ||
    result.intent === "evening_ritual" ||
    result.intent === "goal_update"
  ) {
    try {
      const reviewUrl = await createReviewMagicLink(user.id, today);
      const linkLabel =
        result.intent === "goal_update"
          ? "See your updated goal progress"
          : "View your full review";
      reply = `${reply}\n\n${linkLabel}: ${reviewUrl}`;
    } catch (linkErr) {
      logger.warn(
        { err: linkErr },
        "Failed to generate magic link for WhatsApp response",
      );
    }
  }

  await sendTracked(phone, reply);
}

// ---------------------------------------------------------------------------
// Cloud API webhook payload shape (POST body, already signature-verified):
// entry[].changes[].value.messages[] — incoming user messages
// entry[].changes[].value.statuses[] — delivery/read receipts (ignored)
// ---------------------------------------------------------------------------
interface CloudApiMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}
interface CloudApiWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: CloudApiMessage[] };
    }>;
  }>;
}

export async function processWebhookPayload(
  body: CloudApiWebhookBody,
): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        if (msg.type !== "text") continue;
        if (cacheHas(msg.id)) continue;
        cacheSet(msg.id);

        const phone = msg.from;
        const text = msg.text?.body ?? "";
        if (!text.trim()) continue;

        logger.info(
          { phone: phone.slice(-4) + "****" },
          "Incoming WhatsApp message",
        );

        try {
          await handleIncomingMessage(phone, text);
        } catch (err) {
          logger.error({ err }, "Error handling WhatsApp message");
          await sendTracked(
            phone,
            "Something went wrong. Please try again in a moment.",
          );
        }
      }
    }
  }
}
