import { Router, type Request } from "express";
import Stripe from "stripe";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { getTierConfig, tierFromPriceKey, type Tier } from "../lib/tierConfig";
import { logger } from "../lib/logger.js";

const router = Router();

// ── helpers ─────────────────────────────────────────────────────────────────

async function getPriceSettings(): Promise<Record<string, string>> {
  const KEYS = [
    "stripe_price_pro_monthly",
    "stripe_price_pro_yearly",
    "stripe_price_elite_monthly",
    "stripe_billing_webhook_secret",
  ];
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, KEYS));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function findOrCreateCustomer(
  stripe: Stripe,
  user: { id: string; email: string; stripeCustomerId?: string | null }
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });
  await db
    .update(usersTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(usersTable.id, user.id));
  return customer.id;
}

// ── GET /api/billing/status ──────────────────────────────────────────────────

type AR = Request & { userId: string };

router.get("/billing/status", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as AR).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const prices = await getPriceSettings();
    const pricesConfigured = !!(
      prices.stripe_price_pro_monthly && prices.stripe_price_elite_monthly
    );

    const cfg = getTierConfig(user.tier);

    res.json({
      tier: user.tier,
      tierLabel: cfg.label,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionId: user.stripeSubscriptionId,
      pricesConfigured,
      features: {
        dailyMessageCap: cfg.dailyMessageCap,
        goalCountLimit: cfg.goalCountLimit,
        monthlyTokenAllowance: cfg.monthlyTokenAllowance,
        emailChannel: cfg.emailChannel,
        proactiveNudges: cfg.proactiveNudges,
      },
    });
  } catch (err) {
    logger.error({ err }, "billing/status error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── POST /api/billing/checkout ───────────────────────────────────────────────

router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as AR).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { tier, period = "monthly" } = req.body as {
      tier: "pro" | "elite";
      period?: "monthly" | "yearly";
    };

    if (!["pro", "elite"].includes(tier)) {
      res.status(400).json({ error: "Invalid tier" }); return;
    }

    const prices = await getPriceSettings();
    let priceId: string | undefined;
    if (tier === "pro" && period === "yearly") priceId = prices.stripe_price_pro_yearly;
    else if (tier === "pro") priceId = prices.stripe_price_pro_monthly;
    else if (tier === "elite") priceId = prices.stripe_price_elite_monthly;

    if (!priceId) {
      res.status(503).json({
        error: "Stripe products not yet configured. Ask your admin to run Setup Products.",
      }); return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const stripe = await getUncachableStripeClient();
    const customerId = await findOrCreateCustomer(stripe, user);

    // ── Existing subscriber: update subscription item instead of creating a
    //    second subscription (which would double-charge the user).
    if (user.stripeSubscriptionId) {
      let sub: Stripe.Subscription | null = null;
      try {
        sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["items.data"],
        });
      } catch {
        // Subscription no longer exists in Stripe — fall through to checkout.
        logger.warn({ subscriptionId: user.stripeSubscriptionId, userId }, "existing subscriptionId not found in Stripe, creating new checkout");
      }

      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        const item = sub.items.data[0];
        if (!item) { res.status(500).json({ error: "Subscription has no items" }); return; }

        await stripe.subscriptionItems.update(item.id, {
          price: priceId,
          proration_behavior: "create_prorations",
        });

        // The customer.subscription.updated webhook will update the DB tier.
        logger.info({ userId, priceId }, "subscription item updated — tier upgrade applied");
        res.json({ upgraded: true });
        return;
      }
    }

    const origin = req.headers.origin ?? req.headers.referer ?? "http://localhost:3000";
    const base = origin.replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/account`,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "billing/checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── GET /api/billing/portal ──────────────────────────────────────────────────

router.get("/billing/portal", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as AR).userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user?.stripeCustomerId) {
      res.status(400).json({
        error: "No billing account found. Upgrade first to access the portal.",
      }); return;
    }

    const stripe = await getUncachableStripeClient();
    const origin = req.headers.origin ?? req.headers.referer ?? "http://localhost:3000";
    const base = origin.replace(/\/$/, "");

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/account`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "billing/portal error");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// ── POST /api/billing/webhook ────────────────────────────────────────────────
// (registered in app.ts before express.json() with express.raw())

export async function handleBillingWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const prices = await getPriceSettings();
  const webhookSecret = prices.stripe_billing_webhook_secret;

  if (!webhookSecret) {
    throw new Error(
      "stripe_billing_webhook_secret is not configured. " +
      "Set it in Admin → Stripe settings to enable billing webhooks."
    );
  }

  const stripe = await getUncachableStripeClient();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!userId || !subscriptionId) {
        logger.warn({ session: session.id }, "checkout.session.completed missing metadata");
        break;
      }

      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });
      const priceId = subscription.items.data[0]?.price?.id ?? "";
      const tier = tierFromPriceKey(priceId, prices);
      const cfg = getTierConfig(tier);

      await db
        .update(usersTable)
        .set({
          tier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          dailyMessageCap: cfg.dailyMessageCap,
          monthlyTokenAllowance: cfg.monthlyTokenAllowance,
          monthlySkipCredits: cfg.monthlySkipCredits,
        })
        .where(eq(usersTable.id, userId));

      logger.info({ userId, tier, subscriptionId }, "checkout completed — tier activated");
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) {
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.stripeCustomerId, customerId))
          .limit(1);
        if (!user) { logger.warn({ customerId }, "sub.updated: no user found"); break; }
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = tierFromPriceKey(priceId, prices);
        const cfg = getTierConfig(tier);
        await db
          .update(usersTable)
          .set({ tier, dailyMessageCap: cfg.dailyMessageCap, monthlyTokenAllowance: cfg.monthlyTokenAllowance, monthlySkipCredits: cfg.monthlySkipCredits })
          .where(eq(usersTable.id, user.id));
        logger.info({ userId: user.id, tier }, "subscription.updated via customerId");
        break;
      }
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const tier = tierFromPriceKey(priceId, prices);
      const cfg = getTierConfig(tier);
      await db
        .update(usersTable)
        .set({ tier, stripeSubscriptionId: sub.id, dailyMessageCap: cfg.dailyMessageCap, monthlyTokenAllowance: cfg.monthlyTokenAllowance, monthlySkipCredits: cfg.monthlySkipCredits })
        .where(eq(usersTable.id, userId));
      logger.info({ userId, tier }, "subscription updated — tier changed");
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const cfg = getTierConfig("free");

      const whereClause = userId
        ? eq(usersTable.id, userId)
        : eq(usersTable.stripeSubscriptionId, sub.id);

      await db
        .update(usersTable)
        .set({
          tier: "free",
          stripeSubscriptionId: null,
          dailyMessageCap: cfg.dailyMessageCap,
          monthlyTokenAllowance: cfg.monthlyTokenAllowance,
          monthlySkipCredits: cfg.monthlySkipCredits,
        })
        .where(whereClause);

      logger.info({ userId, subscriptionId: sub.id }, "subscription deleted — downgraded to free");
      break;
    }

    default:
      logger.debug({ type: event.type }, "billing webhook: unhandled event");
  }
}

// ── POST /api/admin/stripe/seed-products ────────────────────────────────────

router.post("/admin/stripe/seed-products", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    async function findOrCreateProduct(name: string): Promise<Stripe.Product> {
      const list = await stripe.products.list({ limit: 100 });
      const existing = list.data.find((p) => p.name === name && p.active);
      if (existing) return existing;
      return stripe.products.create({ name });
    }

    async function findOrCreatePrice(
      productId: string,
      unitAmount: number,
      interval: "month" | "year"
    ): Promise<Stripe.Price> {
      const list = await stripe.prices.list({ product: productId, active: true, limit: 100 });
      const existing = list.data.find(
        (p) =>
          p.unit_amount === unitAmount &&
          p.recurring?.interval === interval &&
          p.currency === "usd"
      );
      if (existing) return existing;
      return stripe.prices.create({
        product: productId,
        unit_amount: unitAmount,
        currency: "usd",
        recurring: { interval },
      });
    }

    const [freeProduct, proProduct, eliteProduct] = await Promise.all([
      findOrCreateProduct("GotThis Free"),
      findOrCreateProduct("GotThis Pro"),
      findOrCreateProduct("GotThis Elite"),
    ]);

    const [proMonthly, proYearly, eliteMonthly] = await Promise.all([
      findOrCreatePrice(proProduct.id, 1200, "month"),
      findOrCreatePrice(proProduct.id, 9900, "year"),
      findOrCreatePrice(eliteProduct.id, 2900, "month"),
    ]);

    const upsertSetting = (key: string, value: string) =>
      db
        .insert(appSettingsTable)
        .values({ key, value })
        .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });

    await Promise.all([
      upsertSetting("stripe_price_pro_monthly", proMonthly.id),
      upsertSetting("stripe_price_pro_yearly", proYearly.id),
      upsertSetting("stripe_price_elite_monthly", eliteMonthly.id),
    ]);

    res.json({
      success: true,
      products: {
        free: freeProduct.id,
        pro: proProduct.id,
        elite: eliteProduct.id,
      },
      prices: {
        pro_monthly: proMonthly.id,
        pro_yearly: proYearly.id,
        elite_monthly: eliteMonthly.id,
      },
    });
  } catch (err) {
    logger.error({ err }, "seed-products error");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
