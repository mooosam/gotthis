import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { achievementsTable, db, goalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { nanoid } from "nanoid";

const router: IRouter = Router();

function achievementPayload(achievement: typeof achievementsTable.$inferSelect, goalTitle?: string | null) {
  const hideGoalName = achievement.metadata?.shareHideGoalName === true;
  return {
    id: achievement.id,
    achievementType: achievement.achievementType,
    title: achievement.title,
    subtitle: hideGoalName && goalTitle && achievement.subtitle === goalTitle ? "Personal goal" : achievement.subtitle,
    value: achievement.value,
    valueLabel: achievement.valueLabel,
    goalId: achievement.goalId,
    goalTitle: hideGoalName ? null : goalTitle ?? null,
    metadata: achievement.metadata,
    shareToken: achievement.shareToken,
    sharedAt: achievement.sharedAt,
    createdAt: achievement.createdAt,
  };
}

router.get("/achievements", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const rows = await db
    .select({ achievement: achievementsTable, goalTitle: goalsTable.title })
    .from(achievementsTable)
    .leftJoin(goalsTable, eq(achievementsTable.goalId, goalsTable.id))
    .where(eq(achievementsTable.userId, userId))
    .orderBy(desc(achievementsTable.createdAt));
  res.json({ achievements: rows.map(({ achievement, goalTitle }) => achievementPayload(achievement, goalTitle)) });
});

router.post("/achievements/:id/share", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = String(req.params.id ?? "");
  const hideGoalName = req.body?.hideGoalName === true;
  const [achievement] = await db
    .select()
    .from(achievementsTable)
    .where(and(eq(achievementsTable.id, id), eq(achievementsTable.userId, userId)));
  if (!achievement) { res.status(404).json({ error: "Achievement not found" }); return; }

  const shareToken = achievement.shareToken ?? nanoid(12);
  const metadata = { ...(achievement.metadata ?? {}), shareHideGoalName: hideGoalName };
  await db
    .update(achievementsTable)
    .set({ shareToken, sharedAt: new Date(), metadata })
    .where(and(eq(achievementsTable.id, id), eq(achievementsTable.userId, userId)));

  res.json({ shareToken, publicPath: `/achievement/${shareToken}`, cardPath: `/api/achievement-share/${shareToken}/card.svg` });
});

router.delete("/achievements/:id/share", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const id = String(req.params.id ?? "");
  await db
    .update(achievementsTable)
    .set({ shareToken: null, sharedAt: null })
    .where(and(eq(achievementsTable.id, id), eq(achievementsTable.userId, userId)));
  res.sendStatus(204);
});

async function findSharedAchievement(token: string) {
  const [row] = await db
    .select({ achievement: achievementsTable, goalTitle: goalsTable.title })
    .from(achievementsTable)
    .leftJoin(goalsTable, eq(achievementsTable.goalId, goalsTable.id))
    .where(eq(achievementsTable.shareToken, token));
  return row ?? null;
}

router.get("/achievement-share/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  if (token.length < 8) { res.status(400).json({ error: "Invalid share token" }); return; }
  const row = await findSharedAchievement(token);
  if (!row) { res.status(404).json({ error: "Achievement not found" }); return; }
  res.json(achievementPayload(row.achievement, row.goalTitle));
});

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

router.get("/achievement-share/:token/card.svg", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const row = await findSharedAchievement(token);
  if (!row) { res.status(404).type("text/plain").send("Achievement not found"); return; }
  const achievement = achievementPayload(row.achievement, row.goalTitle);
  const title = escapeXml(achievement.title.toUpperCase());
  const subtitle = escapeXml(achievement.goalTitle ?? achievement.subtitle ?? "KEEP GOING");
  const value = achievement.value == null ? "" : escapeXml(achievement.value);
  const valueLabel = achievement.valueLabel ? escapeXml(achievement.valueLabel) : "";
  const valueLine = value ? `${value} ${valueLabel}`.trim() : "ACHIEVEMENT UNLOCKED";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101828"/>
      <stop offset="100%" stop-color="#1d2939"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7f56d9"/>
      <stop offset="100%" stop-color="#9e77ed"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" rx="56" fill="url(#bg)"/>
  <text x="540" y="135" text-anchor="middle" fill="#d0d5dd" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8">GOTTHIS</text>
  <circle cx="540" cy="315" r="92" fill="#7f56d9" opacity="0.18"/>
  <text x="540" y="340" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="86" font-weight="800">✓</text>
  <text x="540" y="500" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="800">${title}</text>
  <text x="540" y="570" text-anchor="middle" fill="#d0d5dd" font-family="Arial, sans-serif" font-size="34">${subtitle}</text>
  <rect x="190" y="655" width="700" height="28" rx="14" fill="#344054"/>
  <rect x="190" y="655" width="700" height="28" rx="14" fill="url(#bar)"/>
  <text x="540" y="790" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="52" font-weight="700">${escapeXml(valueLine)}</text>
  <text x="540" y="900" text-anchor="middle" fill="#98a2b3" font-family="Arial, sans-serif" font-size="30">Small steps. Real progress.</text>
  <text x="540" y="970" text-anchor="middle" fill="#d0d5dd" font-family="Arial, sans-serif" font-size="28" font-weight="700">gotthis.one</text>
</svg>`;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(svg);
});

export default router;
