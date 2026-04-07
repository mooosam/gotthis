import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { nanoid } from "nanoid";
import {
  ListDailyLogsQueryParams,
  GetDailyLogParams,
  CreateDailyLogBody,
  UpdateDailyLogParams,
  UpdateDailyLogBody,
  DeleteDailyLogParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/daily-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = ListDailyLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 30, offset = 0 } = parsed.data;

  const logs = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, userId))
    .orderBy(desc(dailyLogsTable.logDate))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

router.post("/daily-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;

  const parsed = CreateDailyLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { logDate, data, narrative } = parsed.data;

  const [log] = await db
    .insert(dailyLogsTable)
    .values({
      id: nanoid(),
      userId,
      logDate,
      data: data ?? null,
      narrative: narrative ?? null,
    })
    .returning();

  res.status(201).json(log);
});

router.get(
  "/daily-logs/:date",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const parsed = GetDailyLogParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [log] = await db
      .select()
      .from(dailyLogsTable)
      .where(
        and(
          eq(dailyLogsTable.userId, userId),
          eq(dailyLogsTable.logDate, parsed.data.date),
        ),
      );

    if (!log) {
      res.status(404).json({ error: "Daily log not found" });
      return;
    }

    res.json(log);
  },
);

router.patch(
  "/daily-logs/:date",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const paramsParsed = UpdateDailyLogParams.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: paramsParsed.error.message });
      return;
    }

    const bodyParsed = UpdateDailyLogBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }

    const { data, narrative } = bodyParsed.data;
    const updates: Partial<typeof dailyLogsTable.$inferInsert> = {};
    if (data !== undefined) updates.data = data;
    if (narrative !== undefined) updates.narrative = narrative;

    const [log] = await db
      .update(dailyLogsTable)
      .set(updates)
      .where(
        and(
          eq(dailyLogsTable.userId, userId),
          eq(dailyLogsTable.logDate, paramsParsed.data.date),
        ),
      )
      .returning();

    if (!log) {
      res.status(404).json({ error: "Daily log not found" });
      return;
    }

    res.json(log);
  },
);

router.delete(
  "/daily-logs/:date",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as typeof req & { userId: string }).userId;

    const parsed = DeleteDailyLogParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [log] = await db
      .delete(dailyLogsTable)
      .where(
        and(
          eq(dailyLogsTable.userId, userId),
          eq(dailyLogsTable.logDate, parsed.data.date),
        ),
      )
      .returning();

    if (!log) {
      res.status(404).json({ error: "Daily log not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
