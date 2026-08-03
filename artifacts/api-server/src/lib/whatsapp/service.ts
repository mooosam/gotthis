import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import type { BaileysEventMap } from "@whiskeysockets/baileys";
import path from "node:path";
import fs from "node:fs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPhone } from "../phone.js";
import { processMessage } from "../ai/processor.js";
import { createReviewMagicLink, getBaseUrl } from "./magic-link.js";
import { checkBudgetForUser } from "../ai/usage.js";
import { recordInboundEngagement } from "../ai/engagement.js";
import { logger } from "../logger.js";
import type { User } from "@workspace/db";

const AUTH_DIR = path.resolve(process.cwd(), ".whatsapp-auth");

function jidToPhone(jid: string): string {
  return jid.split("@")[0];
}

export type WAStatus = "disconnected" | "connecting" | "open";

let currentQR: string | null = null;
let pairingCode: string | null = null;
let currentStatus: WAStatus = "disconnected";
let connectedPhone: string | null = null;
let sock: ReturnType<typeof makeWASocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPairingPhone: string | null = null;

// Track message IDs that the bot itself sent, so we can ignore their echo
// in messages.upsert without dropping genuine user self-messages.
const botSentIds = new Set<string>();

export function getQR(): string | null {
  return currentQR;
}

export function getPairingCode(): string | null {
  return pairingCode;
}

export function getStatus(): WAStatus {
  return currentStatus;
}

export function getConnectedPhone(): string | null {
  return connectedPhone;
}

async function findUserByPhone(phone: string, jid: string): Promise<User | null> {
  const hashed = hashPhone(phone);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phoneHash, hashed));

  if (user && user.whatsappJid !== jid) {
    await db.update(usersTable).set({ whatsappJid: jid }).where(eq(usersTable.id, user.id));
  }

  return user ?? null;
}

async function sendTracked(jid: string, text: string): Promise<void> {
  const result = await sock?.sendMessage(jid, { text });
  if (result?.key?.id) botSentIds.add(result.key.id);
}

export async function sendToJid(jid: string, text: string): Promise<void> {
  await sendTracked(jid, text);
}

async function sendWelcomeSequence(jid: string): Promise<void> {
  const base = getBaseUrl();
  const messages = [
    `Welcome to The Ritual AI! I'm your personal goal coaching assistant.`,
    `To get started, sign up at ${base} and link your phone number in Account Settings. Once set up, message me each morning and evening to track your goals and get personalised coaching.`,
    `If you already have an account, go to Account Settings and enter this number — then come back and say good morning!`,
  ];

  for (const text of messages) {
    await sendTracked(jid, text);
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function handleIncomingMessage(jid: string, phone: string, text: string): Promise<void> {
  const user = await findUserByPhone(phone, jid);

  if (!user) {
    await sendWelcomeSequence(jid);
    return;
  }

  if (!user.onboardingCompleted) {
    const base = getBaseUrl();
    await sendTracked(jid, `Your account is almost ready. Please finish setting up your timezone and goals at ${base}/onboarding — then message me again to start your first ritual.`);
    return;
  }

  // Single source of truth for daily/monthly budget — same check the dashboard
  // route uses. Stops a user who is over their cap before we spend tokens
  // running the classifier or the ritual handler.
  const budgetCheck = checkBudgetForUser(user);
  if (!budgetCheck.allowed) {
    const base = getBaseUrl();
    const upgradeHint = budgetCheck.upgradePrompt
      ? `\n\n👉 Upgrade now: ${base}/pricing`
      : "";
    await sendTracked(jid, (budgetCheck.reason ?? "Daily message limit reached.") + upgradeHint);
    return;
  }

  // Adaptive nudging: record this inbound message's local hour so we can later
  // pick the user's preferred push time. Errors here must not block the reply.
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
      logger.warn({ err: linkErr }, "Failed to generate magic link for WhatsApp response");
    }
  }

  await sendTracked(jid, reply);
}

async function connect(phoneForPairing?: string): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  currentStatus = "connecting";
  currentQR = null;
  pairingCode = null;

  const usePairingCode = !!phoneForPairing;

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: !usePairingCode,
    logger: logger.child({ module: "baileys" }) as Parameters<typeof makeWASocket>[0]["logger"],
    browser: ["The Ritual AI", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  if (usePairingCode && phoneForPairing && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const normalised = phoneForPairing.replace(/\D/g, "");
        const code = await sock!.requestPairingCode(normalised);
        pairingCode = code;
        pendingPairingPhone = phoneForPairing;
        logger.info({ phone: normalised.slice(-4) + "****" }, "Pairing code generated");
      } catch (err) {
        logger.error({ err }, "Failed to request pairing code");
      }
    }, 3000);
  }

  sock.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      currentStatus = "connecting";
      logger.info("WhatsApp QR code updated — scan to connect");
    }

    if (connection === "close") {
      currentStatus = "disconnected";
      currentQR = null;
      pairingCode = null;
      pendingPairingPhone = null;
      connectedPhone = null;
      const reason = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logger.warn({ reason }, "WhatsApp connection closed");

      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          connect().catch((err) => logger.error({ err }, "WhatsApp reconnect failed"));
        }, 5000);
      } else {
        logger.info("WhatsApp logged out — clearing auth state");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        // Reconnect with fresh state so a new QR / pairing code is generated
        reconnectTimer = setTimeout(() => {
          connect().catch((err) => logger.error({ err }, "WhatsApp reconnect (fresh) failed"));
        }, 3000);
      }
    }

    if (connection === "open") {
      // Clear any queued reconnect from a prior close — otherwise it could
      // fire mid-connection and create a leaked socket.
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      currentStatus = "open";
      currentQR = null;
      pairingCode = null;
      pendingPairingPhone = null;
      // Extract connected phone number from the socket user JID
      const rawJid = sock?.user?.id ?? "";
      connectedPhone = rawJid ? jidToPhone(rawJid).split(":")[0] : null;
      logger.info({ connectedPhone }, "WhatsApp connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const msgId = msg.key.id ?? "";

      // Only process messages sent TO this number, never FROM it.
      // fromMe=true covers both the bot's own replies and any message the
      // account owner sends from their phone to someone else — both must be
      // ignored so we don't reply in unrelated chats.
      if (msg.key.fromMe) {
        botSentIds.delete(msgId);
        continue;
      }

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;

      const phone = jidToPhone(jid);

      const text =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        "";

      if (!text.trim()) continue;

      logger.info({ phone: phone.slice(-4) + "****", fromMe: msg.key.fromMe }, "Incoming WhatsApp message");

      try {
        await handleIncomingMessage(jid, phone, text);
      } catch (err) {
        logger.error({ err }, "Error handling WhatsApp message");
        await sendTracked(jid, "Something went wrong. Please try again in a moment.");
      }
    }
  });
}

export async function startWhatsApp(): Promise<void> {
  try {
    await connect();
  } catch (err) {
    logger.error({ err }, "Failed to start WhatsApp service");
    reconnectTimer = setTimeout(() => {
      void connect();
    }, 10000);
  }
}

export async function requestPairingCode(phone: string): Promise<string> {
  // Disconnect any existing socket, then reconnect using the pairing-code path
  // inside connect(). connect() calls sock.requestPairingCode() via a 3-second
  // setTimeout — BEFORE the first QR is generated — which is the timing Baileys
  // requires. Waiting for a QR event and calling it afterwards (the old approach)
  // was too late and caused Baileys to throw.
  await disconnectWhatsApp();
  await new Promise((r) => setTimeout(r, 500));
  await connect(phone);

  // Poll for pairingCode to be written by the setTimeout inside connect().
  // Give it up to 30 seconds (the 3-second delay + Baileys round-trip).
  return new Promise<string>((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const poll = setInterval(() => {
      if (pairingCode) {
        clearInterval(poll);
        logger.info({ phone: phone.replace(/\D/g, "").slice(-4) + "****" }, "Pairing code issued");
        resolve(pairingCode);
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Timed out waiting for pairing code — check the phone number and try again"));
      }
    }, 250);
  });
}

export async function disconnectWhatsApp(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    await sock.logout().catch(() => {});
    sock = null;
  }
  currentStatus = "disconnected";
  currentQR = null;
  pairingCode = null;
  pendingPairingPhone = null;
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
