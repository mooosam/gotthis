import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.put("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { timezone, phone, newsletterCadence } = req.body as {
    timezone?: string;
    phone?: string;
    newsletterCadence?: string;
  };

  const updates: Partial<typeof usersTable.$inferSelect> = {};
  if (timezone !== undefined) updates.timezone = timezone;
  if (phone !== undefined) updates.phone = phone;
  if (newsletterCadence !== undefined)
    updates.newsletterCadence = newsletterCadence;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(updated);
});

router.post(
  "/users/me/complete-onboarding",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const [updated] = await db
      .update(usersTable)
      .set({ onboardingCompleted: true })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updated);
  },
);

export default router;
