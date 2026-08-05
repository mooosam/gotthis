import { Router, type IRouter } from "express";
import { eq, and, desc, asc, like, or, sql, count, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  plansTable,
  goalsTable,
  dailyLogsTable,
  usageTrackingTable,
  magicLinksTable,
  memorySummariesTable,
  emailMessagesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.use(requireAuth, requireAdmin);

// -----------------------------------------------------------------------------
// Overview / dashboard stats
// -----------------------------------------------------------------------------

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const today = new Date().toISOString().slice(0, 10);

  const [userTotals] = await db
    .select({ total: count() })
    .from(usersTable);

  const [activeUsers] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(gte(usersTable.updatedAt, sevenDaysAgo));

  const [adminCount] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, true));

  const [suspendedCount] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.isSuspended, true));

  const [goalTotals] = await db
    .select({ total: count() })
    .from(goalsTable);

  const [activeGoalsCount] = await db
    .select({ total: count() })
    .from(goalsTable)
    .where(eq(goalsTable.status, "active"));

  const [logTotals] = await db
    .select({ total: count() })
    .from(dailyLogsTable);

  // MySQL: use CAST(... AS UNSIGNED) instead of PostgreSQL ::int cast
  const [todayUsage] = await db
    .select({
      messages: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.messageCount}), 0) AS UNSIGNED)`,
      input: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenInputCount}), 0) AS UNSIGNED)`,
      output: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenOutputCount}), 0) AS UNSIGNED)`,
      cacheHits: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenCacheHitCount}), 0) AS UNSIGNED)`,
    })
    .from(usageTrackingTable)
    .where(eq(usageTrackingTable.periodDate, today));

  const usageByDay = await db
    .select({
      date: usageTrackingTable.periodDate,
      messages: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.messageCount}), 0) AS UNSIGNED)`,
      input: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenInputCount}), 0) AS UNSIGNED)`,
      output: sql<number>`CAST(COALESCE(SUM(${usageTrackingTable.tokenOutputCount}), 0) AS UNSIGNED)`,
    })
    .from(usageTrackingTable)
    .where(gte(usageTrackingTable.periodDate, sevenDaysAgo.toISOString().slice(0, 10)))
    .groupBy(usageTrackingTable.periodDate)
    .orderBy(asc(usageTrackingTable.periodDate));

  const tierBreakdown = await db
    .select({
      tier: usersTable.tier,
      total: count(),
    })
    .from(usersTable)
    .groupBy(usersTable.tier)
    .orderBy(desc(count()));

  const plansRows = await db.select().from(plansTable);
  const planByTier = new Map(plansRows.map((p) => [p.slug, p]));
  let mrrCents = 0;
  for (const row of tierBreakdown) {
    const plan = planByTier.get(row.tier);
    if (!plan) continue;
    const monthlyCents =
      plan.billingPeriod === "annual"
        ? Math.round(plan.priceCents / 12)
        : plan.priceCents;
    mrrCents += monthlyCents * row.total;
  }

  res.json({
    totals: {
      users: userTotals?.total ?? 0,
      activeUsers: activeUsers?.total ?? 0,
      admins: adminCount?.total ?? 0,
      suspended: suspendedCount?.total ?? 0,
      goals: goalTotals?.total ?? 0,
      activeGoals: activeGoalsCount?.total ?? 0,
      logs: logTotals?.total ?? 0,
    },
    today: {
      messages: todayUsage?.messages ?? 0,
      tokenInput: todayUsage?.input ?? 0,
      tokenOutput: todayUsage?.output ?? 0,
      tokenCacheHits: todayUsage?.cacheHits ?? 0,
    },
    usageByDay,
    tierBreakdown,
    mrrCents,
  });
});

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

router.get("/admin/users", async (req, res): Promise<void> => {
  const search = String(req.query.search ?? "").trim();
  const tier = String(req.query.tier ?? "").trim();
  const limitRaw = Number(req.query.limit ?? 50);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const filters = [] as Array<ReturnType<typeof eq>>;
  if (search.length > 0) {
    const pattern = `%${search}%`;
    const orFilter = or(
      like(usersTable.email, pattern),
      like(usersTable.id, pattern),
    );
    if (orFilter) filters.push(orFilter as ReturnType<typeof eq>);
  }
  if (tier.length > 0) {
    filters.push(eq(usersTable.tier, tier));
  }
  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const baseQuery = db.select().from(usersTable);
  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const totalQuery = db.select({ total: count() }).from(usersTable);
  const [totalRow] = await (whereClause ? totalQuery.where(whereClause) : totalQuery);

  res.json({
    users: rows,
    total: totalRow?.total ?? 0,
    limit,
    offset,
  });
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [goalCount] = await db
    .select({ total: count() })
    .from(goalsTable)
    .where(eq(goalsTable.userId, id));

  const [logCount] = await db
    .select({ total: count() })
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.userId, id));

  const recentUsage = await db
    .select()
    .from(usageTrackingTable)
    .where(eq(usageTrackingTable.userId, id))
    .orderBy(desc(usageTrackingTable.periodDate))
    .limit(30);

  const recentGoals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, id))
    .orderBy(desc(goalsTable.createdAt))
    .limit(10);

  res.json({
    user,
    counts: {
      goals: goalCount?.total ?? 0,
      logs: logCount?.total ?? 0,
    },
    recentUsage,
    recentGoals,
  });
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const requesterId = (req as typeof req & { userId: string }).userId;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (typeof body.tier === "string") updates.tier = body.tier;
  if (typeof body.dailyMessageCap === "number" && body.dailyMessageCap >= 0) {
    updates.dailyMessageCap = Math.floor(body.dailyMessageCap);
  }
  if (typeof body.monthlyTokenAllowance === "number" && body.monthlyTokenAllowance >= 0) {
    updates.monthlyTokenAllowance = Math.floor(body.monthlyTokenAllowance);
  }
  if (typeof body.monthlySkipCredits === "number" && body.monthlySkipCredits >= 0) {
    updates.monthlySkipCredits = Math.floor(body.monthlySkipCredits);
  }
  if (typeof body.isAdmin === "boolean") {
    if (id === requesterId && body.isAdmin === false) {
      res.status(400).json({ error: "You cannot remove your own admin access." });
      return;
    }
    updates.isAdmin = body.isAdmin;
  }
  if (typeof body.isSuspended === "boolean") {
    if (id === requesterId && body.isSuspended === true) {
      res.status(400).json({ error: "You cannot suspend your own account." });
      return;
    }
    updates.isSuspended = body.isSuspended;
  }
  if (typeof body.email === "string" && body.email.length > 0) {
    updates.email = body.email;
  }
  if (typeof body.timezone === "string" && body.timezone.length > 0) {
    updates.timezone = body.timezone;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  // MySQL: no .returning() — update then re-select
  await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id));

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  logger.info({ adminId: requesterId, targetId: id, updates }, "admin updated user");
  res.json(updated);
});

router.post("/admin/users/:id/apply-plan", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.slug, user.tier));
  if (!plan) {
    res.status(400).json({ error: `No plan defined for tier "${user.tier}"` });
    return;
  }

  // MySQL: no .returning() — update then re-select
  await db
    .update(usersTable)
    .set({
      dailyMessageCap: plan.dailyMessageCap,
      monthlyTokenAllowance: plan.monthlyTokenAllowance,
      monthlySkipCredits: plan.monthlySkipCredits,
    })
    .where(eq(usersTable.id, id));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  res.json(updated);
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const requesterId = (req as typeof req & { userId: string }).userId;
  const { id } = req.params;

  if (id === requesterId) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  // Check existence before cascading deletes (MySQL: no DELETE...RETURNING)
  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.delete(magicLinksTable).where(eq(magicLinksTable.userId, id));
  await db.delete(memorySummariesTable).where(eq(memorySummariesTable.userId, id));
  await db.delete(emailMessagesTable).where(eq(emailMessagesTable.userId, id));
  await db.delete(goalsTable).where(eq(goalsTable.userId, id));
  await db.delete(dailyLogsTable).where(eq(dailyLogsTable.userId, id));
  await db.delete(usageTrackingTable).where(eq(usageTrackingTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));

  logger.info({ adminId: requesterId, deletedId: id }, "admin deleted user");
  res.status(204).send();
});

// -----------------------------------------------------------------------------
// Plans
// -----------------------------------------------------------------------------

router.get("/admin/plans", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(plansTable)
    .orderBy(asc(plansTable.sortOrder), asc(plansTable.priceCents));
  res.json({ plans });
});

router.post("/admin/plans", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!/^[a-z0-9_-]{1,32}$/.test(slug)) {
    res.status(400).json({ error: "slug must be 1-32 lowercase letters/numbers/-/_" });
    return;
  }
  if (name.length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    // MySQL: no .returning() — insert then re-select by slug
    await db
      .insert(plansTable)
      .values({
        slug,
        name,
        description: typeof body.description === "string" ? body.description : null,
        dailyMessageCap:
          typeof body.dailyMessageCap === "number" ? Math.max(0, Math.floor(body.dailyMessageCap)) : 5,
        monthlyTokenAllowance:
          typeof body.monthlyTokenAllowance === "number"
            ? Math.max(0, Math.floor(body.monthlyTokenAllowance))
            : 50000,
        monthlySkipCredits:
          typeof body.monthlySkipCredits === "number"
            ? Math.max(0, Math.floor(body.monthlySkipCredits))
            : 4,
        priceCents:
          typeof body.priceCents === "number" ? Math.max(0, Math.floor(body.priceCents)) : 0,
        billingPeriod:
          typeof body.billingPeriod === "string" && (body.billingPeriod === "monthly" || body.billingPeriod === "annual")
            ? body.billingPeriod
            : "monthly",
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        sortOrder: typeof body.sortOrder === "number" ? Math.floor(body.sortOrder) : 0,
      });

    const [created] = await db.select().from(plansTable).where(eq(plansTable.slug, slug));
    res.status(201).json(created);
  } catch (err) {
    logger.warn({ err }, "Failed to create plan");
    res.status(409).json({ error: "Plan with that slug already exists" });
  }
});

router.patch("/admin/plans/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const updates: Partial<typeof plansTable.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim().length > 0) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.dailyMessageCap === "number" && body.dailyMessageCap >= 0) {
    updates.dailyMessageCap = Math.floor(body.dailyMessageCap);
  }
  if (typeof body.monthlyTokenAllowance === "number" && body.monthlyTokenAllowance >= 0) {
    updates.monthlyTokenAllowance = Math.floor(body.monthlyTokenAllowance);
  }
  if (typeof body.monthlySkipCredits === "number" && body.monthlySkipCredits >= 0) {
    updates.monthlySkipCredits = Math.floor(body.monthlySkipCredits);
  }
  if (typeof body.priceCents === "number" && body.priceCents >= 0) {
    updates.priceCents = Math.floor(body.priceCents);
  }
  if (typeof body.billingPeriod === "string" && (body.billingPeriod === "monthly" || body.billingPeriod === "annual")) {
    updates.billingPeriod = body.billingPeriod;
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body.sortOrder === "number") updates.sortOrder = Math.floor(body.sortOrder);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  // MySQL: no .returning() — update then re-select
  await db
    .update(plansTable)
    .set(updates)
    .where(eq(plansTable.slug, slug));

  const [updated] = await db.select().from(plansTable).where(eq(plansTable.slug, slug));

  if (!updated) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(updated);
});

router.delete("/admin/plans/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;

  const [usersOnPlan] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.tier, slug));
  if ((usersOnPlan?.total ?? 0) > 0) {
    res.status(409).json({
      error: `Cannot delete: ${usersOnPlan?.total} user(s) are still on this plan.`,
    });
    return;
  }

  // MySQL: no .returning() on DELETE — check existence first
  const [existingPlan] = await db
    .select({ slug: plansTable.slug })
    .from(plansTable)
    .where(eq(plansTable.slug, slug));

  if (!existingPlan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  await db.delete(plansTable).where(eq(plansTable.slug, slug));
  res.status(204).send();
});

export default router;
