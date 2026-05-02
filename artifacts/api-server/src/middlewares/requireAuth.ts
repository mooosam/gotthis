import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ADMIN_BOOTSTRAP_EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "")
  .trim()
  .toLowerCase();

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
    const email =
      (claims["email"] as string | undefined) ??
      (claims["primaryEmail"] as string | undefined) ??
      (claims["emailAddress"] as string | undefined) ??
      "";

    // Bootstrap admin: any user signing up with the configured admin email is
    // auto-flagged. Lets the operator promote themselves without DB access.
    const shouldBeAdmin =
      ADMIN_BOOTSTRAP_EMAIL.length > 0 &&
      email.trim().toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;

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
  }

  if (user?.isSuspended) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  (req as Request & { userId: string; user: typeof user }).userId = user.id;
  (req as Request & { userId: string; user: typeof user }).user = user;
  next();
}
