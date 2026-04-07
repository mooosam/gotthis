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
- `goals` — userId, title, category, deadline, status, progress, streaks
- `daily_logs` — userId, logDate, JSONB data, AI narrative
- `memory_summaries` — userId, JSONB rolling AI summary
- `magic_links` — token, userId, targetDate, targetGoalId, expiresAt

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

## Auth

Clerk auth is integrated server-side. Protected routes use the `requireAuth` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`. First-time auth auto-creates a user record in the DB from Clerk session claims.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
