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
import { checkWhatsAppRateLimit } from "./rate-limit.js";
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

  const rateCheck = await checkWhatsAppRateLimit(user.id);
  if (!rateCheck.allowed) {
    await sendTracked(jid, rateCheck.reason ?? "Daily message limit reached.");
    return;
  }

  const result = await processMessage(user.id, text);

  const today = new Date().toISOString().split("T")[0];
  let reply = result.reply;

  if (result.intent === "morning_ritual" || result.intent === "evening_ritual") {
    try {
      const reviewUrl = await createReviewMagicLink(user.id, today);
      reply = `${reply}\n\nView your full review: ${reviewUrl}`;
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
      const reason = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logger.warn({ reason }, "WhatsApp connection closed");

      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 5000);
      } else {
        logger.info("WhatsApp logged out — clearing auth state");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        // Reconnect with fresh state so a new QR / pairing code is generated
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 3000);
      }
    }

    if (connection === "open") {
      currentStatus = "open";
      currentQR = null;
      pairingCode = null;
      pendingPairingPhone = null;
      logger.info("WhatsApp connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const msgId = msg.key.id ?? "";

      // Skip messages the bot sent (avoid echoing our own replies)
      if (msg.key.fromMe && botSentIds.has(msgId)) {
        botSentIds.delete(msgId);
        continue;
      }

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;

      // jid is already the phone-based JID (without device suffix) in all cases,
      // including self-chat where remoteJid equals the user's own number.
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
  await disconnectWhatsApp();
  await new Promise((r) => setTimeout(r, 1000));

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  currentStatus = "connecting";
  currentQR = null;
  pairingCode = null;

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ module: "baileys" }) as Parameters<typeof makeWASocket>[0]["logger"],
    browser: ["The Ritual AI", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for socket open")), 10000);

    sock!.ev.on("connection.update", (update) => {
      if (update.connection === "open" || update.qr) {
        clearTimeout(timer);
        resolve();
      }
      if (update.connection === "close") {
        clearTimeout(timer);
        reject(new Error("Connection closed before pairing"));
      }
    });
  });

  const normalised = phone.replace(/\D/g, "");
  const code = await sock.requestPairingCode(normalised);
  pairingCode = code;
  pendingPairingPhone = phone;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      currentStatus = "connecting";
    }

    if (connection === "close") {
      currentStatus = "disconnected";
      currentQR = null;
      pairingCode = null;
      pendingPairingPhone = null;
      const reason = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => { void connect(); }, 5000);
      } else {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        reconnectTimer = setTimeout(() => { void connect(); }, 3000);
      }
    }

    if (connection === "open") {
      currentStatus = "open";
      currentQR = null;
      pairingCode = null;
      pendingPairingPhone = null;
      logger.info("WhatsApp connected via pairing code");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;

      const msgId = msg.key.id ?? "";
      if (msg.key.fromMe && botSentIds.has(msgId)) {
        botSentIds.delete(msgId);
        continue;
      }

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;

      const phone = jidToPhone(jid);

      const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? "";
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

  logger.info({ phone: normalised.slice(-4) + "****" }, "Pairing code issued");
  return code;
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
