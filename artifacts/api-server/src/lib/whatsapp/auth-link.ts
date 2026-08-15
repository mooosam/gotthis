import { db, shortAuthLinksTable } from "@workspace/db";
import { customAlphabet, nanoid } from "nanoid";
import { getBaseUrl } from "./magic-link.js";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const createCode = customAlphabet(CODE_ALPHABET, 8);
const SHORT_LINK_TTL_MS = 10 * 60 * 1000;

/**
 * Keep redirects on GotThis. This prevents an auth link from becoming an open
 * redirect to an attacker-controlled site.
 */
export function normalizeAuthDestination(destination: string): string | null {
  const value = destination.trim();
  if (value === "/dashboard" || value === "/activity" || value === "/goals" || value === "/account" || value === "/onboarding") {
    return value;
  }
  if (/^\/goal\/[A-Za-z0-9_-]{1,255}$/.test(value)) return value;
  if (/^\/review\/\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

/**
 * Create a human-friendly short URL for WhatsApp. The database record contains
 * only the GotThis user ID and destination; no Clerk credential is placed in
 * the WhatsApp message. A one-time Clerk ticket is minted at redemption time.
 */
export async function createAuthenticatedShortLink(
  userId: string,
  destination: string,
): Promise<string> {
  const safeDestination = normalizeAuthDestination(destination);
  if (!safeDestination) throw new Error("Unsafe authenticated-link destination");

  const expiresAt = new Date(Date.now() + SHORT_LINK_TTL_MS);

  // A collision is extremely unlikely, but retry a few times so the unique DB
  // constraint remains the final authority.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = createCode();
    try {
      await db.insert(shortAuthLinksTable).values({
        id: nanoid(),
        code,
        userId,
        destination: safeDestination,
        expiresAt,
      });
      return `${getBaseUrl()}/go/${code}`;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }

  throw new Error("Could not create authenticated short link");
}
