---
name: Audit fixes — Aug 2026
description: Security and reliability fixes applied after full codebase audit. Covers what was fixed and what remains.
---

## What was fixed (Critical + High)

- **nginx**: security headers added (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP). HTTPS block prepared but requires `certbot` on Oracle VM to activate.
- **Stripe webhooks**: removed duplicate `/api/stripe/webhook` (Replit-specific `stripe-replit-sync`); `/api/billing/webhook` is the single canonical endpoint. Also removed `runMigrations`/`getStripeSync`/`stripeSync.findOrCreateManagedWebhook` from `index.ts` — dead code on Oracle.
- **Gemini timeout**: 30s `Promise.race` added directly in `lib/integrations-gemini-ai/src/client.ts` — covers all 7 call sites.
- **WhatsApp dedup**: replaced unbounded `botSentIds = new Set()` with a TTL-based `msgCache` Map (10 min TTL, 5 min sweep). Deduplicates re-emitted messages on reconnect. In `lib/whatsapp/service.ts`.
- **usage_tracking index**: composite index `idx_usage_user_date` on `(userId, periodDate)` added to `lib/db/src/schema/usage-tracking.ts`. Needs `drizzle-kit push` on Oracle to apply.
- **MySQL backup**: `deploy/backup-mysql.sh` — uses `docker compose exec mysql mysqldump`, gzips, prunes >7 days. Set up cron: `0 2 * * * /path/to/backup-mysql.sh`.
- **Stripe reconciliation**: `lib/stripe-reconcile.ts` — daily cron at 03:00 UTC, downgrades users whose subscriptions are `canceled/unpaid/past_due/incomplete_expired`.
- **Magic link cleanup**: `lib/cleanup.ts` — daily cron at 04:00 UTC, deletes expired magic links.

## Medium items fixed along the way

- **React ErrorBoundary**: `artifacts/web/src/components/ErrorBoundary.tsx` — wraps entire app.
- **Admin isAdmin guard**: `AdminGuard` component in `App.tsx` — fetches `/api/users/me` and checks `isAdmin` before rendering admin routes.
- **Clerk redirect**: `afterSignInUrl` → `fallbackRedirectUrl` (correct prop for this Clerk version).

## Still outstanding (Medium/Low)

- Health check at `/api/health` does not verify DB connectivity.
- Milestones and admin routes use manual type checking instead of Zod.
- In-memory per-minute throttle resets on container restart (would need Redis for persistence).
- Concurrent AI message processing from same user can race on `recordUsage` (no per-user mutex).
- `reconnectTimer` in WhatsApp service could schedule multiple simultaneous reconnects if `connection.update` fires twice rapidly.
- Memory summaries have no size cap.

**Why:** Each of these is Medium or Low severity. The critical/high items were addressed first per the prioritized fix order.
