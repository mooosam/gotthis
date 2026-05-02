import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const ADMIN_BOOTSTRAP_EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "")
  .trim()
  .toLowerCase();

async function fetchClerkEmail(clerkId: string): Promise<string> {
  try {
    const u = await clerkClient.users.getUser(clerkId);
    const primaryId = u.primaryEmailAddressId;
    const primary = u.emailAddresses.find((e) => e.id === primaryId);
    return (primary?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "").trim();
  } catch (err) {
    logger.warn({ err, clerkId }, "Failed to fetch email from Clerk");
    return "";
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clerkId));

  if (!user) {
    const claims = auth.sessionClaims ?? {};
    let email =
      ((claims["email"] as string | undefined) ??
        (claims["primaryEmail"] as string | undefined) ??
        (claims["emailAddress"] as string | undefined) ??
        "").trim();

    // Session claims usually don't include email — fetch from Clerk directly.
    if (!email) {
      email = await fetchClerkEmail(clerkId);
    }

    // Bootstrap admin: any user signing up with the configured admin email is
    // auto-flagged. Lets the operator promote themselves without DB access.
    const shouldBeAdmin =
      ADMIN_BOOTSTRAP_EMAIL.length > 0 &&
      email.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;

    [user] = await db
      .insert(usersTable)
      .values({
        id: clerkId,
        email,
        tier: "free",
        dailyMessageCap: 5,
        monthlyTokenAllowance: 50000,
        isAdmin: shouldBeAdmin,
      })
      .onConflictDoNothing()
      .returning();

    if (!user) {
      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, clerkId));
    }
  }

  // Backfill missing email from Clerk if older accounts have no email recorded
  // (this also enables the idempotent admin upgrade below to work for them).
  if (user && !user.email) {
    const fresh = await fetchClerkEmail(clerkId);
    if (fresh) {
      [user] = await db
        .update(usersTable)
        .set({ email: fresh })
        .where(eq(usersTable.id, user.id))
        .returning();
    }
  }

  // Idempotent admin upgrade for users that existed before the bootstrap email
  // was configured.
  if (
    user &&
    !user.isAdmin &&
    ADMIN_BOOTSTRAP_EMAIL.length > 0 &&
    user.email.trim().toLowerCase() === ADMIN_BOOTSTRAP_EMAIL
  ) {
    [user] = await db
      .update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.id, user.id))
      .returning();
    logger.info({ userId: user.id }, "Auto-promoted bootstrap admin");
  }

  if (user?.isSuspended) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  (req as Request & { userId: string; user: typeof user }).userId = user.id;
  (req as Request & { userId: string; user: typeof user }).user = user;
  next();
}
