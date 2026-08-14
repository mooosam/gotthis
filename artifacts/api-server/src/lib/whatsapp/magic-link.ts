import { db, magicLinksTable } from "@workspace/db";
import { nanoid } from "nanoid";

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  return process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";
}

export async function createReviewMagicLink(
  userId: string,
  date: string,
): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(magicLinksTable).values({
    id: nanoid(),
    userId,
    token,
    targetDate: date,
    targetGoalId: null,
    expiresAt,
  });

  return `${getBaseUrl()}/review/${date}?token=${token}`;
}

export { getBaseUrl };
