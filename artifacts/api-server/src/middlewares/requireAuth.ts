import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

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
    .where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    const email =
      (auth.sessionClaims?.email as string) ??
      (auth.sessionClaims?.primaryEmail as string) ??
      "";
    [user] = await db
      .insert(usersTable)
      .values({
        id: nanoid(),
        clerkId,
        email,
        tier: "free",
        dailyMessageCap: 5,
        monthlyTokenAllowance: 50000,
      })
      .returning();
  }

  (req as Request & { userId: string; user: typeof user }).userId = user.id;
  (req as Request & { userId: string; user: typeof user }).user = user;
  next();
}
