import { Router } from "express";
import { sql, eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// ── API key management ──────────────────────────────────────────────────────

router.get("/admin/stripe/key", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "stripe_secret_key"))
      .limit(1);
    if (!row) return res.json({ stored: false, preview: null });
    const key = row.value;
    const preview = key.startsWith("sk_") ? `${key.slice(0, 7)}…${key.slice(-4)}` : `${key.slice(0, 4)}…${key.slice(-4)}`;
    res.json({ stored: true, preview, updatedAt: row.updatedAt });
  } catch (err) {
    logger.error({ err }, "Failed to get stripe key");
    res.status(500).json({ error: "Failed to retrieve key" });
  }
});

router.post("/admin/stripe/key", async (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== "string" || key.trim().length < 10) {
    return res.status(400).json({ error: "A valid Stripe secret key is required" });
  }
  const trimmed = key.trim();
  if (!trimmed.startsWith("sk_")) {
    return res.status(400).json({ error: "Key must start with sk_ (Stripe secret key)" });
  }
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: "stripe_secret_key", value: trimmed })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: trimmed, updatedAt: new Date() } });
    const preview = `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
    res.json({ stored: true, preview });
  } catch (err) {
    logger.error({ err }, "Failed to save stripe key");
    res.status(500).json({ error: "Failed to save key" });
  }
});

router.delete("/admin/stripe/key", async (_req, res) => {
  try {
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "stripe_secret_key"));
    res.json({ stored: false });
  } catch (err) {
    logger.error({ err }, "Failed to delete stripe key");
    res.status(500).json({ error: "Failed to remove key" });
  }
});

// ── Webhook secret management ────────────────────────────────────────────────

router.get("/admin/stripe/webhook-secret", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "stripe_billing_webhook_secret"))
      .limit(1);
    if (!row) return res.json({ stored: false, preview: null });
    const val = row.value;
    const preview = `${val.slice(0, 6)}…${val.slice(-4)}`;
    res.json({ stored: true, preview, updatedAt: row.updatedAt });
  } catch (err) {
    logger.error({ err }, "Failed to get webhook secret");
    res.status(500).json({ error: "Failed to retrieve secret" });
  }
});

router.post("/admin/stripe/webhook-secret", async (req, res) => {
  const { secret } = req.body as { secret?: string };
  if (!secret || typeof secret !== "string" || secret.trim().length < 10) {
    return res.status(400).json({ error: "A valid webhook signing secret is required" });
  }
  const trimmed = secret.trim();
  if (!trimmed.startsWith("whsec_")) {
    return res.status(400).json({ error: "Secret must start with whsec_ (Stripe webhook signing secret)" });
  }
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: "stripe_billing_webhook_secret", value: trimmed })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: trimmed, updatedAt: new Date() } });
    const preview = `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
    res.json({ stored: true, preview });
  } catch (err) {
    logger.error({ err }, "Failed to save webhook secret");
    res.status(500).json({ error: "Failed to save secret" });
  }
});

router.delete("/admin/stripe/webhook-secret", async (_req, res) => {
  try {
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "stripe_billing_webhook_secret"));
    res.json({ stored: false });
  } catch (err) {
    logger.error({ err }, "Failed to delete webhook secret");
    res.status(500).json({ error: "Failed to remove secret" });
  }
});

async function queryStripe<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  try {
    const result = await db.execute(query);
    return result.rows as T[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema')) {
      return [];
    }
    throw err;
  }
}

router.get("/admin/stripe/status", async (_req, res) => {
  try {
    const rows = await queryStripe(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'stripe' LIMIT 1
    `);
    res.json({ connected: rows.length > 0 });
  } catch {
    res.json({ connected: false });
  }
});

router.get("/admin/stripe/overview", async (_req, res) => {
  try {
    const [revenue, transactions, subscriptions, refundTotal, customers] = await Promise.all([
      queryStripe(sql`
        SELECT COALESCE(SUM(amount_received), 0) AS total,
               COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_received ELSE 0 END), 0) AS succeeded
        FROM stripe.payment_intents
        WHERE status = 'succeeded'
      `),
      queryStripe(sql`
        SELECT COUNT(*) AS total,
               COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS succeeded,
               COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed
        FROM stripe.payment_intents
      `),
      queryStripe(sql`
        SELECT COUNT(*) AS total,
               COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
               COUNT(CASE WHEN status = 'canceled' THEN 1 END) AS canceled,
               COUNT(CASE WHEN status = 'past_due' THEN 1 END) AS past_due
        FROM stripe.subscriptions
      `),
      queryStripe(sql`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM stripe.refunds
      `),
      queryStripe(sql`SELECT COUNT(*) AS total FROM stripe.customers`),
    ]);

    res.json({
      revenue:       revenue[0]       ?? { total: 0, succeeded: 0 },
      transactions:  transactions[0]  ?? { total: 0, succeeded: 0, failed: 0 },
      subscriptions: subscriptions[0] ?? { total: 0, active: 0, canceled: 0, past_due: 0 },
      refunds:       refundTotal[0]   ?? { total: 0, count: 0 },
      customers:     customers[0]     ?? { total: 0 },
    });
  } catch (err) {
    logger.error({ err }, "Stripe overview error");
    res.status(500).json({ error: "Failed to fetch Stripe overview" });
  }
});

router.get("/admin/stripe/charges", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Number(req.query.offset) || 0;
  try {
    const rows = await queryStripe(sql`
      SELECT
        pi.id, pi.amount, pi.amount_received, pi.currency,
        pi.status, pi.created, pi.description,
        c.email AS customer_email, c.name AS customer_name
      FROM stripe.payment_intents pi
      LEFT JOIN stripe.customers c ON c.id = pi.customer
      ORDER BY pi.created DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const [countRow] = await queryStripe<{ total: number }>(
      sql`SELECT COUNT(*) AS total FROM stripe.payment_intents`
    );
    res.json({ data: rows, total: Number(countRow?.total ?? 0) });
  } catch (err) {
    logger.error({ err }, "Stripe charges error");
    res.status(500).json({ error: "Failed to fetch charges" });
  }
});

router.get("/admin/stripe/subscriptions", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Number(req.query.offset) || 0;
  try {
    const rows = await queryStripe(sql`
      SELECT
        s.id, s.status, s.current_period_start, s.current_period_end,
        s.cancel_at_period_end, s.created, s.canceled_at,
        c.email AS customer_email, c.name AS customer_name,
        p.unit_amount, p.currency, p.recurring,
        pr.name AS product_name
      FROM stripe.subscriptions s
      LEFT JOIN stripe.customers  c  ON c.id = s.customer
      LEFT JOIN stripe.subscription_items si ON si.subscription = s.id
      LEFT JOIN stripe.prices     p  ON p.id = si.price
      LEFT JOIN stripe.products   pr ON pr.id = p.product
      ORDER BY s.created DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const [countRow] = await queryStripe<{ total: number }>(
      sql`SELECT COUNT(*) AS total FROM stripe.subscriptions`
    );
    res.json({ data: rows, total: Number(countRow?.total ?? 0) });
  } catch (err) {
    logger.error({ err }, "Stripe subscriptions error");
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.get("/admin/stripe/customers", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const search = (req.query.search as string | undefined)?.trim() ?? "";
  try {
    const rows = await queryStripe(sql`
      SELECT
        c.id, c.email, c.name, c.created, c.currency,
        COUNT(DISTINCT s.id) AS subscription_count,
        COUNT(DISTINCT pi.id) AS payment_count,
        COALESCE(SUM(CASE WHEN pi.status = 'succeeded' THEN pi.amount_received END), 0) AS total_spent
      FROM stripe.customers c
      LEFT JOIN stripe.subscriptions    s  ON s.customer = c.id
      LEFT JOIN stripe.payment_intents  pi ON pi.customer = c.id
      ${search ? sql`WHERE c.email ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'}` : sql``}
      GROUP BY c.id, c.email, c.name, c.created, c.currency
      ORDER BY c.created DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const [countRow] = await queryStripe<{ total: number }>(
      search
        ? sql`SELECT COUNT(*) AS total FROM stripe.customers WHERE email ILIKE ${'%' + search + '%'} OR name ILIKE ${'%' + search + '%'}`
        : sql`SELECT COUNT(*) AS total FROM stripe.customers`
    );
    res.json({ data: rows, total: Number(countRow?.total ?? 0) });
  } catch (err) {
    logger.error({ err }, "Stripe customers error");
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/admin/stripe/refunds", async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Number(req.query.offset) || 0;
  try {
    const rows = await queryStripe(sql`
      SELECT
        r.id, r.amount, r.currency, r.status, r.reason,
        r.created, r.charge,
        c.email AS customer_email, c.name AS customer_name
      FROM stripe.refunds r
      LEFT JOIN stripe.charges   ch ON ch.id = r.charge
      LEFT JOIN stripe.customers c  ON c.id  = ch.customer
      ORDER BY r.created DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const [countRow] = await queryStripe<{ total: number }>(
      sql`SELECT COUNT(*) AS total FROM stripe.refunds`
    );
    res.json({ data: rows, total: Number(countRow?.total ?? 0) });
  } catch (err) {
    logger.error({ err }, "Stripe refunds error");
    res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

export default router;
