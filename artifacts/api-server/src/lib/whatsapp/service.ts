import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";
import type { BaileysEventMap } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "node:path";
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { processMessage } from "../ai/processor.js";
import { logger } from "../logger.js";

const AUTH_DIR = path.resolve(process.cwd(), ".whatsapp-auth");
const PHONE_PEPPER = process.env.PHONE_PEPPER ?? "dev-only-not-for-production";

function hashPhone(raw: string): string {
  return createHmac("sha256", PHONE_PEPPER)
    .update(raw.trim().replace(/\s+/g, ""))
    .digest("hex");
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0];
}

export type WAStatus = "disconnected" | "connecting" | "open";

let currentQR: string | null = null;
let currentStatus: WAStatus = "disconnected";
let sock: ReturnType<typeof makeWASocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getQR(): string | null {
  return currentQR;
}

export function getStatus(): WAStatus {
  return currentStatus;
}

async function findUserByPhone(phone: string): Promise<string | null> {
  const hashed = hashPhone(phone);
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phoneHash, hashed));
  return user?.id ?? null;
}

async function connect(): Promise<void> {
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

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: logger.child({ module: "baileys" }) as Parameters<typeof makeWASocket>[0]["logger"],
    browser: ["The Ritual AI", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

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
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logger.warn({ reason }, "WhatsApp connection closed");

      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 5000);
      } else {
        logger.info("WhatsApp logged out — clearing auth state");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    }

    if (connection === "open") {
      currentStatus = "open";
      currentQR = null;
      logger.info("WhatsApp connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: BaileysEventMap["messages.upsert"]) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue;

      const phone = jidToPhone(jid);
      const text =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        "";

      if (!text.trim()) continue;

      logger.info({ phone: phone.slice(-4) + "****" }, "Incoming WhatsApp message");

      try {
        const userId = await findUserByPhone(phone);

        if (!userId) {
          await sock?.sendMessage(jid, {
            text: "Your phone number isn't linked to an account. Sign up at theritual.ai and add your phone in Settings.",
          });
          continue;
        }

        const result = await processMessage(userId, text);

        await sock?.sendMessage(jid, { text: result.reply });
      } catch (err) {
        logger.error({ err }, "Error handling WhatsApp message");
        await sock?.sendMessage(jid, {
          text: "Something went wrong. Please try again in a moment.",
        });
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
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
