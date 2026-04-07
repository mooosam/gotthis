import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, memorySummariesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/memory", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const [summary] = await db
    .select()
    .from(memorySummariesTable)
    .where(eq(memorySummariesTable.userId, userId));

  if (!summary) {
    res.status(404).json({ error: "No memory summary found" });
    return;
  }

  res.json(summary);
});

export default router;
