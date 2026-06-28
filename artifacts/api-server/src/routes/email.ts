import { Router, type IRouter } from "express";
import { db, usersTable, emailMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { processMessage } from "../lib/ai/processor.js";
import { sendReply } from "../lib/email/service.js";
import { getTierConfig } from "../lib/tierConfig.js";
import { logger } from "../lib/logger.js";

interface PostmarkHeader {
  Name: string;
  Value: string;
}

interface PostmarkInboundPayload {
  FromEmail: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  MessageID?: string;
  Headers: PostmarkHeader[];
}

function parseInboundPayload(body: unknown): PostmarkInboundPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b["FromEmail"] !== "string" || !b["FromEmail"]) return null;
  return {
    FromEmail: b["FromEmail"] as string,
    Subject: typeof b["Subject"] === "string" ? b["Subject"] : "",
    TextBody: typeof b["TextBody"] === "string" ? b["TextBody"] : "",
    HtmlBody: typeof b["HtmlBody"] === "string" ? b["HtmlBody"] : "",
    MessageID: typeof b["MessageID"] === "string" ? b["MessageID"] : undefined,
    Headers: Array.isArray(b["Headers"])
      ? (b["Headers"] as unknown[]).filter(
          (h): h is PostmarkHeader =>
            typeof h === "object" &&
            h !== null &&
            typeof (h as Record<string, unknown>)["Name"] === "string" &&
            typeof (h as Record<string, unknown>)["Value"] === "string",
        )
      : [],
  };
}

const router: IRouter = Router();

function extractHeader(headers: PostmarkHeader[], name: string): string {
  return headers.find((h) => h.Name.toLowerCase() === name.toLowerCase())?.Value ?? "";
}

function stripQuotedReplies(text: string): string {
  const lines = text.split("\n");
  const quoteStarts = [/^On .+ wrote:$/, /^>{1,}/, /^-{5,}/, /^_{5,}/];
  let cutAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (quoteStarts.some((re) => re.test(lines[i].trim()))) {
      cutAt = i;
      break;
    }
  }
  return lines.slice(0, cutAt).join("\n").trim();
}

router.post("/email/inbound", async (req, res): Promise<void> => {
  const payload = parseInboundPayload(req.body);
  if (!payload) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { FromEmail, Subject, TextBody, HtmlBody, MessageID, Headers } = payload;

  const inReplyTo = extractHeader(Headers, "in-reply-to");
  const references = extractHeader(Headers, "references");

  const rawBody = TextBody || HtmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cleanBody = stripQuotedReplies(rawBody);

  if (!cleanBody) {
    res.status(200).json({ ok: true });
    return;
  }

  let userId: string | null = null;

  const [userByEmail] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, FromEmail));

  if (userByEmail) {
    userId = userByEmail.id;
  }

  if (!userId && inReplyTo) {
    const refIds = [inReplyTo, ...references.split(/\s+/)].filter(Boolean);
    for (const mid of refIds) {
      const [record] = await db
        .select({ userId: emailMessagesTable.userId })
        .from(emailMessagesTable)
        .where(eq(emailMessagesTable.messageId, mid.replace(/^<|>$/g, "")));
      if (record) {
        userId = record.userId;
        break;
      }
    }
  }

  if (!userId) {
    logger.info({ from: FromEmail }, "Inbound email from unknown sender");
    const fallbackMessageId = MessageID ?? `fallback-${Date.now()}`;
    await sendReply({
      userId: "unmatched",
      toEmail: FromEmail,
      subject: Subject,
      body: "We could not find an account linked to this email address. Please sign up at gotthis.one to get started.",
      inReplyTo: fallbackMessageId,
      references: fallbackMessageId,
    });
    res.status(200).json({ ok: true });
    return;
  }

  // ── Tier gate: email channel requires Pro or Elite ────────────────────────
  const [userRecord] = await db
    .select({ tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const tierCfg = getTierConfig(userRecord?.tier ?? "free");
  if (!tierCfg.emailChannel) {
    const gateMessageId = MessageID ?? `gate-${Date.now()}`;
    await sendReply({
      userId,
      toEmail: FromEmail,
      subject: `Re: ${Subject}`,
      body: "Email coaching is available on GotThis Pro and Elite plans.\n\nUpgrade at https://gotthis.one/account to unlock email coaching, along with 50 messages/day and 10 goals.\n\nYou can still track your goals via WhatsApp.",
      inReplyTo: gateMessageId,
      references: gateMessageId,
    });
    res.status(200).json({ ok: true });
    return;
  }

  let reply: string;
  try {
    const result = await processMessage(userId, cleanBody);
    reply = result.reply;
  } catch (err) {
    logger.error({ err, userId }, "AI processing failed for inbound email");
    reply = "Something went wrong processing your message. Please try again.";
  }

  const outboundInReplyTo = MessageID || inReplyTo || "";
  const outboundReferences = [references, inReplyTo, MessageID]
    .filter(Boolean)
    .join(" ");

  if (outboundInReplyTo) {
    await sendReply({
      userId,
      toEmail: FromEmail,
      subject: Subject,
      body: reply,
      inReplyTo: outboundInReplyTo,
      references: outboundReferences,
    });
  }

  res.status(200).json({ ok: true });
});

export default router;
