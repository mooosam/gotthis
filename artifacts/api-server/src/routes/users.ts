import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { UpdateMyProfileBody } from "@workspace/api-zod";
import { hashPhone } from "../lib/phone";

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

  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { timezone, phone, newsletterCadence } = parsed.data;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (timezone !== undefined) updates.timezone = timezone;
  if (phone !== undefined) updates.phoneHash = hashPhone(phone);
  if (newsletterCadence !== undefined) updates.newsletterCadence = newsletterCadence;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  // MySQL: no .returning() — update then re-select
  await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

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

    // MySQL: no .returning() — update then re-select
    await db
      .update(usersTable)
      .set({ onboardingCompleted: true })
      .where(eq(usersTable.id, userId));

    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updated);
  },
);

export default router;
