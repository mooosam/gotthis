import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/daily-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const rawLimit = Array.isArray(req.query.limit)
    ? req.query.limit[0]
    : req.query.limit;
  const rawOffset = Array.isArray(req.query.offset)
    ? req.query.offset[0]
    : req.query.offset;
  const limit = rawLimit ? parseInt(rawLimit as string, 10) : 30;
  const offset = rawOffset ? parseInt(rawOffset as string, 10) : 0;

  const logs = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, userId))
    .orderBy(desc(dailyLogsTable.logDate))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

router.get(
  "/daily-logs/:date",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;
    const rawDate = Array.isArray(req.params.date)
      ? req.params.date[0]
      : req.params.date;

    const [log] = await db
      .select()
      .from(dailyLogsTable)
      .where(
        and(
          eq(dailyLogsTable.userId, userId),
          eq(dailyLogsTable.logDate, rawDate),
        ),
      );

    if (!log) {
      res.status(404).json({ error: "Daily log not found" });
      return;
    }

    res.json(log);
  },
);

export default router;
