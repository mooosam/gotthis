import * as postmark from "postmark";
import { nanoid } from "nanoid";
import { db, emailMessagesTable } from "@workspace/db";
import { logger } from "../logger.js";
import { renderNewsletterHtml, renderMagicLinkHtml } from "./templates.js";

function getPostmarkClient(): postmark.ServerClient | null {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    logger.warn("POSTMARK_SERVER_TOKEN not set — email sending disabled");
    return null;
  }
  return new postmark.ServerClient(token);
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM ?? "noreply@theritual.ai";
}

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  return "http://localhost:80";
}

async function storeMessageId(
  userId: string,
  messageId: string,
  subject: string,
  emailType: string,
): Promise<void> {
  await db.insert(emailMessagesTable).values({
    id: nanoid(),
    userId,
    messageId,
    subject,
    emailType,
  });
}

export async function sendNewsletter(opts: {
  userId: string;
  toEmail: string;
  userName: string;
  period: string;
  narrative: string;
  inReplyTo?: string;
}): Promise<void> {
  const client = getPostmarkClient();
  const subject = `Your Ritual progress — ${opts.period}`;
  const htmlBody = renderNewsletterHtml({
    userName: opts.userName,
    period: opts.period,
    narrative: opts.narrative,
    dashboardUrl: getAppUrl(),
  });

  if (!client) {
    logger.info({ userId: opts.userId }, "Newsletter email skipped (no Postmark token)");
    return;
  }

  try {
    const result = await client.sendEmail({
      From: getFromEmail(),
      To: opts.toEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: opts.narrative,
      ReplyTo: getFromEmail(),
      ...(opts.inReplyTo ? { Headers: [{ Name: "In-Reply-To", Value: opts.inReplyTo }, { Name: "References", Value: opts.inReplyTo }] } : {}),
    });

    if (result.MessageID) {
      await storeMessageId(opts.userId, result.MessageID, subject, "newsletter");
    }

    logger.info({ userId: opts.userId, messageId: result.MessageID }, "Newsletter email sent");
  } catch (err) {
    logger.error({ err, userId: opts.userId }, "Failed to send newsletter email");
    throw err;
  }
}

export async function sendMagicLink(opts: {
  userId: string;
  toEmail: string;
  reviewUrl: string;
  date: string;
}): Promise<void> {
  const client = getPostmarkClient();
  const subject = `Your Ritual review link — ${opts.date}`;
  const htmlBody = renderMagicLinkHtml({ reviewUrl: opts.reviewUrl, date: opts.date });

  if (!client) {
    logger.info({ userId: opts.userId }, "Magic link email skipped (no Postmark token)");
    return;
  }

  try {
    const result = await client.sendEmail({
      From: getFromEmail(),
      To: opts.toEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Open your review for ${opts.date}: ${opts.reviewUrl}`,
      ReplyTo: getFromEmail(),
    });

    if (result.MessageID) {
      await storeMessageId(opts.userId, result.MessageID, subject, "magic_link");
    }

    logger.info({ userId: opts.userId, messageId: result.MessageID }, "Magic link email sent");
  } catch (err) {
    logger.error({ err, userId: opts.userId }, "Failed to send magic link email");
    throw err;
  }
}

export async function sendReply(opts: {
  userId: string;
  toEmail: string;
  subject: string;
  body: string;
  inReplyTo: string;
  references: string;
}): Promise<void> {
  const client = getPostmarkClient();
  const replySubject = opts.subject.startsWith("Re:")
    ? opts.subject
    : `Re: ${opts.subject}`;

  if (!client) {
    logger.info({ userId: opts.userId }, "Reply email skipped (no Postmark token)");
    return;
  }

  try {
    const result = await client.sendEmail({
      From: getFromEmail(),
      To: opts.toEmail,
      Subject: replySubject,
      TextBody: opts.body,
      ReplyTo: getFromEmail(),
      Headers: [
        { Name: "In-Reply-To", Value: opts.inReplyTo },
        { Name: "References", Value: opts.references },
      ],
    });

    if (result.MessageID) {
      await storeMessageId(opts.userId, result.MessageID, replySubject, "inbound_reply");
    }

    logger.info({ userId: opts.userId, messageId: result.MessageID }, "Reply email sent");
  } catch (err) {
    logger.error({ err, userId: opts.userId }, "Failed to send reply email");
    throw err;
  }
}
