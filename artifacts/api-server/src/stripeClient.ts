import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';
import { db, appSettingsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function getStoredKey(): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, 'stripe_secret_key'))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function getConnectorKey(): Promise<{ secretKey: string; webhookSecret?: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const resp = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
      {
        headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const settings = data.items?.[0]?.settings;
    const secretKey = settings?.secret_key ?? settings?.secret;
    if (!secretKey) return null;
    return { secretKey, webhookSecret: settings.webhook_secret ?? settings.webhook_signing_secret };
  } catch {
    return null;
  }
}

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  // 1. DB-stored key takes priority (entered via admin UI)
  const stored = await getStoredKey();
  if (stored) return { secretKey: stored };

  // 2. Replit connector
  const connector = await getConnectorKey();
  if (connector) return connector;

  // 3. Env var fallback
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) return { secretKey: envKey };

  throw new Error(
    'No Stripe secret key found. Enter it on the Admin → Stripe page, ' +
    'connect via the Integrations tab, or set STRIPE_SECRET_KEY env var.'
  );
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? '',
  });
}
