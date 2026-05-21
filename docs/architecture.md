# Neuron Architecture

## Runtime

- `neuron_frontend`: Next.js pages app, talks to backend via REST + Socket.io.
- `neuron_backend`: Express API, Prisma ORM, Socket.io server.
- `workers/analyticsWorker.js`: drains `analytics_outbox` into ClickHouse (or logs fallback).
- `workers/digestWorker.js`: sends daily email digests from unread notifications.

## Data layer

- PostgreSQL + Prisma is the source of truth for auth, projects, conversations, notifications, votes.
- Redis is required for refresh sessions, auth hardening, and multi-instance socket adapters.
- Cloudflare R2 stores media objects; backend signs upload URLs and stores metadata.

## Core bounded contexts

- **Auth**: password + OAuth, refresh sessions, invite gate, email verify/reset.
- **Resonance**: threads, replies, synthesis, votes, recommendations.
- **Projects**: repo files by branch, head-branch PRs, collaborators (READ/WRITE/MAINTAINER), PR reviews, branch protection + CI merge gates, issues.
- **Dialogue**: DM/groups, message requests, notifications.
- **Moderation**: reports and block graph.

## Event flow

- User action -> route handler -> DB write -> notification emit.
- `utils/notify.js` sends in-app socket notification and email fallback (if verified email exists).
- Product analytics events are enqueued to `analytics_outbox` and shipped asynchronously by worker.

## Deployment topology (minimum prod)

- API service (Express + Socket.io)
- Frontend service (Next.js)
- Redis
- Postgres
- Background workers: analytics + digest
- Optional: ClickHouse
- Sentry: `SENTRY_DSN` (API + workers), `NEXT_PUBLIC_SENTRY_DSN` (frontend); see `utils/sentry.js`

## Data access

Domain logic uses `services/*` modules with direct Prisma queries. API responses are shaped via `utils/serialize.js` (`formatThread`, `formatReply`, etc.). Legacy Mongoose-style model wrappers and `chainable` query builders were removed.

## Known constraints

- Project storage is currently DB file snapshots, not native git objects.
- Git SSH server requires persistent host key in production (`SSH_GIT_HOST_KEY*`).
- Some legacy Mongo-style filter patterns remain in query helpers and should be normalized to pure Prisma idioms.
- CI runner executes shell steps directly and requires stronger sandboxing for untrusted code.
