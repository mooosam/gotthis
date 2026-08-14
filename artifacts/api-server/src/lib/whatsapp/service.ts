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
import { downloadWhatsAppMedia, transcribeWithElevenLabs } from "./voice.js";
import { validateVoiceTranscription } from "../ai/policy.js";

export type WAStatus = "disconnected" | "open";

const CACHE_TTL_MS = 10 * 60 * 1000;
const SWEEP_MS = 5 * 60 * 1000;
const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024;
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

async function handleIncomingMessage(phone: string, text: string): Promise<void> {
  const user = await findUserByPhone(phone);

  if (!user) return;

  const command = text.trim().toLowerCase();
  if (command === "dashboard" || command === "dash") {
    const base = getBaseUrl();
    const reply = `Here’s your GotThis dashboard:\n\n${base}/dashboard`;
    await sendTracked(phone, reply);
    return;
  }

  if (!user.onboardingCompleted) {
    const base = getBaseUrl();
    const reply = `Your account is almost ready. Please finish setting up your timezone and goals at ${base}/onboarding — then message me again to start your first ritual.`;
    await sendTracked(phone, reply);
    return;
  }

  const budgetCheck = checkBudgetForUser(user);
  if (!budgetCheck.allowed) {
    const base = getBaseUrl();
    const upgradeHint = budgetCheck.upgradePrompt
      ? `\n\n👉 Upgrade now: ${base}/pricing`
      : "";
    const reply = (budgetCheck.reason ?? "Daily message limit reached.") + upgradeHint;
    await sendTracked(phone, reply);
    return;
  }

  try {
    await recordInboundEngagement(user.id);
  } catch (engagementErr) {
    logger.warn({ err: engagementErr }, "Failed to record engagement sample");
  }

  const result = await processMessage(user.id, text);

  logger.info(
    { phone: phone.slice(-4) + "****", intent: result.intent, voice: false },
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

interface CloudApiMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
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
        if (msg.type !== "text" && msg.type !== "audio") continue;
        if (cacheHas(msg.id)) continue;
        cacheSet(msg.id);

        const phone = msg.from;
        let text = "";

        try {
          if (msg.type === "audio" && msg.audio?.id) {
            logger.info(
              { phone: phone.slice(-4) + "****", mediaId: msg.audio.id },
              "Incoming WhatsApp voice message",
            );
            const media = await downloadWhatsAppMedia(msg.audio.id);
            if (media.data.length > MAX_VOICE_AUDIO_BYTES) {
              await sendTracked(phone, "That voice note is too large. Please send a shorter voice note and try again.");
              continue;
            }

            text = await transcribeWithElevenLabs(media.data, media.mimeType);
            const voicePolicy = validateVoiceTranscription(text);
            if (!voicePolicy.allowed) {
              await sendTracked(phone, voicePolicy.reply);
              continue;
            }
            text = voicePolicy.normalizedMessage;

            logger.info(
              { phone: phone.slice(-4) + "****", transcriptionChars: text.length },
              "WhatsApp voice message transcribed",
            );
          } else {
            text = msg.text?.body ?? "";
          }

          if (!text.trim()) continue;
          await handleIncomingMessage(phone, text);
        } catch (err) {
          logger.error({ err }, "Error handling WhatsApp message");
          await sendTracked(phone, "Something went wrong. Please try again in a moment.");
        }
      }
    }
  }
}
