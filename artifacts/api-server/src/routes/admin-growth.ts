import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  goalsTable,
  activityEventsTable,
  achievementsTable,
  usageTrackingTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { isGrowthMode, proactiveWhatsAppEnabled } from "../lib/growth-mode.js";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

router.get("/admin/growth", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const d1 = dateDaysAgo(1);
  const d7 = dateDaysAgo(7);
  const d30 = dateDaysAgo(30);
  const dt7 = new Date(`${d7}T00:00:00Z`);
  const dt30 = new Date(`${d30}T00:00:00Z`);

  const [
    [totalUsers], [new7], [new30], [whatsappUsers], [onboarded],
    [totalGoals], [completedGoals], [activeGoals],
    [totalAchievements], [sharedAchievements],
    dauRows, wauRows, mauRows,
    goalCadence, goalStatus, activitySources, activityTypes,
    usage30,
  ] = await Promise.all([
    db.select({ total: count() }).from(usersTable),
    db.select({ total: count() }).from(usersTable).where(gte(usersTable.createdAt, dt7)),
    db.select({ total: count() }).from(usersTable).where(gte(usersTable.createdAt, dt30)),
    db.select({ total: count() }).from(usersTable).where(isNotNull(usersTable.whatsappJid)),
    db.select({ total: count() }).from(usersTable).where(eq(usersTable.onboardingCompleted, true)),
    db.select({ total: count() }).from(goalsTable),
    db.select({ total: count() }).from(goalsTable).where(eq(goalsTable.status, "completed")),
    db.select({ total: count() }).from(goalsTable).where(eq(goalsTable.status, "active")),
    db.select({ total: count() }).from(achievementsTable),
    db.select({ total: count() }).from(achievementsTable).where(isNotNull(achievementsTable.sharedAt)),
    db.select({ total: sql<number>`COUNT(DISTINCT ${usageTrackingTable.userId})` }).from(usageTrackingTable).where(eq(usageTrackingTable.periodDate, today)),
    db.select({ total: sql<number>`COUNT(DISTINCT ${usageTrackingTable.userId})` }).from(usageTrackingTable).where(gte(usageTrackingTable.periodDate, d7)),
    db.select({ total: sql<number>`COUNT(DISTINCT ${usageTrackingTable.userId})` }).from(usageTrackingTable).where(gte(usageTrackingTable.periodDate, d30)),
    db.select({ name: goalsTable.cadence, total: count() }).from(goalsTable).groupBy(goalsTable.cadence).orderBy(desc(count())),
    db.select({ name: goalsTable.status, total: count() }).from(goalsTable).groupBy(goalsTable.status).orderBy(desc(count())),
    db.select({ name: activityEventsTable.source, total: count() }).from(activityEventsTable).where(gte(activityEventsTable.occurredAt, dt30)).groupBy(activityEventsTable.source).orderBy(desc(count())),
    db.select({ name: activityEventsTable.eventType, total: count() }).from(activityEventsTable).where(gte(activityEventsTable.occurredAt, dt30)).groupBy(activityEventsTable.eventType).orderBy(desc(count())).limit(15),
    db.select({
      date: usageTrackingTable.periodDate,
      messages: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.messageCount}), 0) AS UNSIGNED)`,
      inputTokens: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenInputCount}), 0) AS UNSIGNED)`,
      outputTokens: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenOutputCount}), 0) AS UNSIGNED)`,
      activeUsers: sql<number>`COUNT(DISTINCT ${usageTrackingTable.userId})`,
    }).from(usageTrackingTable).where(gte(usageTrackingTable.periodDate, d30)).groupBy(usageTrackingTable.periodDate).orderBy(usageTrackingTable.periodDate),
  ]);

  const users = totalUsers?.total ?? 0;
  const goals = totalGoals?.total ?? 0;
  const achievements = totalAchievements?.total ?? 0;
  const messages30 = usage30.reduce((n, r) => n + Number(r.messages ?? 0), 0);
  const input30 = usage30.reduce((n, r) => n + Number(r.inputTokens ?? 0), 0);
  const output30 = usage30.reduce((n, r) => n + Number(r.outputTokens ?? 0), 0);

  res.json({
    mode: {
      growthMode: isGrowthMode(),
      paidTierEnforcement: !isGrowthMode(),
      proactiveWhatsApp: proactiveWhatsAppEnabled(),
      userInitiatedUsage: isGrowthMode() ? "unlimited" : "tier_limited",
    },
    acquisition: {
      totalUsers: users,
      newUsers7d: new7?.total ?? 0,
      newUsers30d: new30?.total ?? 0,
      whatsappConnected: whatsappUsers?.total ?? 0,
      whatsappConnectionRate: users ? Math.round(((whatsappUsers?.total ?? 0) / users) * 1000) / 10 : 0,
      onboarded: onboarded?.total ?? 0,
      activationRate: users ? Math.round(((onboarded?.total ?? 0) / users) * 1000) / 10 : 0,
    },
    engagement: {
      dau: Number(dauRows[0]?.total ?? 0),
      wau: Number(wauRows[0]?.total ?? 0),
      mau: Number(mauRows[0]?.total ?? 0),
      messages30d: messages30,
      messagesPerMau: Number(mauRows[0]?.total ?? 0) ? Math.round((messages30 / Number(mauRows[0]!.total)) * 10) / 10 : 0,
    },
    goals: {
      total: goals,
      active: activeGoals?.total ?? 0,
      completed: completedGoals?.total ?? 0,
      completionRate: goals ? Math.round(((completedGoals?.total ?? 0) / goals) * 1000) / 10 : 0,
      cadence: goalCadence,
      status: goalStatus,
    },
    sharing: {
      achievements,
      sharedAchievements: sharedAchievements?.total ?? 0,
      shareRate: achievements ? Math.round(((sharedAchievements?.total ?? 0) / achievements) * 1000) / 10 : 0,
    },
    ai: {
      inputTokens30d: input30,
      outputTokens30d: output30,
      totalTokens30d: input30 + output30,
    },
    activity: { sources: activitySources, eventTypes: activityTypes },
    usage30d: usage30,
  });
});

export default router;
