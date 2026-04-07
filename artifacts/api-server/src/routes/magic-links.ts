import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, magicLinksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { nanoid } from "nanoid";
import { CreateMagicLinkBody, ResolveMagicLinkParams } from "@workspace/api-zod";
const MagicLinkBodyRefined = CreateMagicLinkBody.refine(
  (d) => d.targetDate != null || d.targetGoalId != null,
  { message: "At least one of targetDate or targetGoalId is required" },
);

const router: IRouter = Router();

router.post("/magic-links", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = MagicLinkBodyRefined.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetDate, targetGoalId } = parsed.data;

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";

  const url = targetDate
    ? `${baseUrl}/review/${targetDate}?token=${token}`
    : `${baseUrl}/goal/${targetGoalId}?token=${token}`;

  const [link] = await db
    .insert(magicLinksTable)
    .values({
      id: nanoid(),
      userId,
      token,
      targetDate: targetDate ?? null,
      targetGoalId: targetGoalId ?? null,
      expiresAt,
    })
    .returning();

  res.status(201).json({
    token: link.token,
    url,
    expiresAt: link.expiresAt.toISOString(),
  });
});

router.get(
  "/magic-links/:token/resolve",
  async (req, res): Promise<void> => {
    const parsed = ResolveMagicLinkParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [link] = await db
      .select()
      .from(magicLinksTable)
      .where(eq(magicLinksTable.token, parsed.data.token));

    if (!link || link.expiresAt < new Date()) {
      res.status(404).json({ error: "Magic link not found or expired" });
      return;
    }

    if (!link.usedAt) {
      await db
        .update(magicLinksTable)
        .set({ usedAt: new Date() })
        .where(eq(magicLinksTable.id, link.id));
    }

    res.json({
      userId: link.userId,
      targetDate: link.targetDate,
      targetGoalId: link.targetGoalId,
    });
  },
);

export default router;
