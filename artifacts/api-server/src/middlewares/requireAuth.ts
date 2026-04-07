import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    [user] = await db
      .insert(usersTable)
      .values({
        id: clerkId,
        email,
        tier: "free",
        dailyMessageCap: 5,
        monthlyTokenAllowance: 50000,
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

  (req as Request & { userId: string; user: typeof user }).userId = user.id;
  (req as Request & { userId: string; user: typeof user }).user = user;
  next();
}
