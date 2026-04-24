# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is **The Ritual AI** — a WhatsApp-first AI goal coaching SaaS where users interact via WhatsApp and get concise AI responses with links to a rich web dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (JWT-based, server-side via @clerk/express)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Product Description

The Ritual AI is a goal coaching app where:
- Users interact primarily via WhatsApp (concise replies + magic links to web dashboard)
- AI-powered morning/evening rituals (Claude API with prompt caching)
- Web dashboard for deep dives: charts, goal history, daily log narratives
- Weekly AI-generated newsletter via email
- Inbound email replies parsed and processed by AI
- 3 subscription tiers: Free, Pro ($12/mo), Elite ($29/mo)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables

- `users` — Clerk ID, email, phone (WhatsApp), IANA timezone, subscription tier, usage counters
- `goals` — userId, title, category, deadline (text, YYYY-MM-DD), status, progress, streaks, lastCheckedAt
- `daily_logs` — userId, logDate, JSONB data, AI narrative
- `memory_summaries` — userId, JSONB rolling AI summary
- `magic_links` — token, userId, targetDate, targetGoalId, expiresAt

### DB Schema Notes
- `goals.deadline` is stored as `text` (not `date`) for compatibility with existing data
- `goals.lastCheckedAt` is nullable timestamp added in sync with schema

## API Endpoints

- `GET /api/healthz` — health check (public)
- `GET /api/users/me` — current user profile
- `PUT /api/users/me` — update profile (timezone, phone, newsletter cadence)
- `POST /api/users/me/complete-onboarding` — mark onboarding complete
- `GET /api/goals` — list goals (optional ?status= filter)
- `POST /api/goals` — create goal
- `GET /api/goals/:id` — get goal
- `PATCH /api/goals/:id` — update goal
- `DELETE /api/goals/:id` — delete goal
- `GET /api/daily-logs` — list daily logs
- `GET /api/daily-logs/:date` — get log for date (YYYY-MM-DD)
- `GET /api/memory` — get rolling memory summary
- `GET /api/dashboard/stats` — dashboard stats (goals, logs, streaks, weekly rate)
- `POST /api/magic-links` — generate time-limited magic link
- `GET /api/magic-links/:token/resolve` — resolve magic link (public)
- `POST /api/ai/message` — send a message to the AI coach (requires auth); returns `{reply, intent, usage}`
- `POST /api/ai/memory/refresh` — regenerate the rolling memory summary from last 7 days of logs (requires auth, metered against daily budget)
- `GET /api/whatsapp/status` — check WhatsApp connection status and QR availability (requires auth)
- `GET /api/whatsapp/qr` — get current WhatsApp QR code string or connected status (requires auth)
- `POST /api/whatsapp/disconnect` — disconnect WhatsApp session and clear auth state (requires auth)

## AI Ritual Engine (artifacts/api-server/src/lib/ai/)

The AI engine is built around Claude (claude-sonnet-4-6) with prompt caching. Files:
- `context.ts` — Context Skyscraper assembly: loads user, active goals, memory summary, last 48h logs
- `classifier.ts` — Keyword-based intent classification: `morning_ritual`, `evening_ritual`, `goal_update`, `check_in`, `off_topic`
- `usage.ts` — Daily message cap + monthly token budget enforcement; tracks usage in `usage_tracking` table
- `morning.ts` — Morning ritual handler: sets intentions, references active goals, caches context
- `evening.ts` — Evening ritual handler: reflection + narrative generation, upserts daily_log, updates goal lastCheckedAt
- `checkin.ts` — General check-in handler: goal updates, mid-day responses, off-topic redirection
- `memory.ts` — Rolling memory consolidation using claude-haiku-4-5; summarizes last 7 days into structured JSON
- `processor.ts` — Entry point: assembles context, checks budget, classifies intent, routes to handler, records usage

### Prompt Caching Strategy
- System prompt block: `cache_control: {type: "ephemeral"}`
- User context block (memory + goals): `cache_control: {type: "ephemeral"}`
- Recent logs block: NOT cached (changes frequently, caching would waste cache slots)
- Current message: no cache

### AI Integration
- Uses `@workspace/integrations-anthropic-ai` (Replit AI Integrations, no user key needed)
- Env vars: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto-set)

## WhatsApp Integration (artifacts/api-server/src/lib/whatsapp/)

Baileys-based WhatsApp Web connection. No Twilio/Meta API required — uses WhatsApp Web protocol.

- `service.ts` — Singleton Baileys connection. Manages QR generation, reconnection on drop, and incoming message routing.
- Auth state persisted to `.whatsapp-auth/` directory (gitignored)
- On incoming message: hash sender phone → look up user by `phoneHash` → call `processMessage` → reply
- Unlinked senders get a registration prompt pointing them to the dashboard
- QR code is stored in-memory and exposed at `GET /api/whatsapp/qr`; web UI polls every 4 seconds
- Service auto-restarts after disconnection (5s delay); clears auth on logout

### Setup
1. Go to `/whatsapp` in the dashboard
2. Scan the QR code with WhatsApp (Settings → Linked Devices → Link a Device)
3. Ensure your phone number is saved in account settings (in E.164 format, e.g. `+15551234567`)

## Auth

Clerk auth is integrated server-side. Protected routes use the `requireAuth` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`. First-time auth auto-creates a user record in the DB from Clerk session claims.

## Web Dashboard (artifacts/web)

React + Vite frontend at root path `/`. Built with:
- **Routing**: Wouter (base-path aware)
- **Auth**: @clerk/react with Clerk proxy
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data viz**: Recharts (progress/streak charts)
- **Theme**: Dark/light mode support, "Parchment & Ink" aesthetic

### Pages
- `/` — Landing page (public) / redirects authenticated users to /dashboard
- `/sign-in`, `/sign-up` — Clerk-embedded auth flows
- `/onboarding` — Timezone setup + optional phone (WhatsApp) for new users
- `/dashboard` — Stats overview, streaks, recent logs, top goals
- `/goals` — Goals list with status filtering; create goal dialog
- `/goal/:goalId` — Goal detail with Recharts progress chart, CRUD operations
- `/review/:date` — Daily log view/edit for a specific date (YYYY-MM-DD)
- `/account` — Tier badge, usage meters, profile settings
- `/whatsapp` — WhatsApp QR code connect/disconnect page; polls `/api/whatsapp/qr` every 4s

### Auth Flow
- New Clerk users are auto-provisioned in the DB on first authenticated request (see `requireAuth.ts`)
- Users with `onboardingCompleted === false` are redirected to `/onboarding`
- Protected pages use `<Show when="signed-in">` and `<Show when="signed-out">` from @clerk/react

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
