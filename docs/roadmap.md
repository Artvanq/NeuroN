# Neuron Roadmap

## Q2 2026 — Production Foundation

- [x] Email plumbing (Resend) + notification email fanout
- [x] Password reset by email token
- [x] Email verification flow
- [x] OAuth unlink endpoint
- [x] Analytics worker ClickHouse integration
- [x] Digest worker and compose wiring
- [x] OpenAPI + architecture docs baseline
- [x] Moderator web inbox UI
- [x] Account deletion and data export
- [x] Sentry + alerting baseline

## Q3 2026 — Projects v2

- [x] Collaborators and granular repo permissions
- [x] Head-branch based PR model
- [x] PR review comments and approvals
- [x] Required CI checks + branch protection
- [x] Project search in global search API

## Q4 2026 — Resonance + Dialogue depth

- [x] Community moderators and per-category rules
- [x] Rich media compose UI (POST + CHAT)
- [x] Message reactions, edit/delete, read receipts
- [x] Notification preferences panel
- [x] Full-text search backend (Postgres FTS or Elasticsearch)

## 2027 — Platform hardening

- [x] Native git transport (HTTP/SSH) — read-only git bundle + info/refs baseline; smart HTTP/SSH push planned
- [x] Security hardening (2FA, session list, key rotation policy)
- [x] Legal pages + cookie consent
- [x] Load/perf and E2E test suites — platform smoke tests (`tests/smoke.platform.test.js`)
- [x] CI/CD hardening for backend/frontend/workers — Prisma generate before tests

## 2028 — Git v2 + scale

- [x] Smart HTTP git push (`git-receive-pack` → DB sync, branch protection)
- [x] Personal access tokens for git/CI (instead of password/JWT)
- [x] SSH git transport
- [x] OpenAPI coverage sync — 2FA, git, collaborators, category mods, message reactions
- [x] CI worker smoke checks
- [x] Playwright E2E baseline

## 2029 — Budget VPS + platform namespaces

- [x] Single-server deploy (`docker-compose.prod.yml`, `.env.budget.example`)
- [x] Local media storage (`MEDIA_STORAGE=local`) — no R2 bill
- [x] Budget deploy guide (`docs/BUDGET-DEPLOY.md`) + Caddy example

## 2030 — Deploy + platform namespaces

- [x] Deploy guide (`docs/DEPLOY.md`) + Railway service configs
- [x] GitHub Actions `deploy.yml` (verify, migrate, load-smoke)
- [x] Postgres backup script (`scripts/backup-postgres.sh`)
- [x] Load smoke in CI (`npm run test:load`)
- [x] Web Push (VAPID, subscriptions, SW)
- [x] Organizations API + UI (`/api/orgs`, `/orgs/*`)
- [x] Project forks (`POST /api/projects/:owner/:slug/fork`)

## 2031 — Text v1 + orgs polish (in progress)

- [x] Coolify-first deploy (`docs/COOLIFY.md`, `MEDIA_STORAGE=disabled`)
- [x] Issue labels + kanban views (list / status board / by label)
- [x] `GET /api/orgs/mine`, `/orgs` index, remove/leave member
- [x] `docs/STATUS.md` — живой чеклист по вашему плану
- [x] Milestones & assignees on issues
- [x] Project visibility (public/private)
- [x] Lock thread (Resonance)
- [x] Issue templates, star/watch, pin thread
- [x] In-project issue comments (timeline + notifications)
- [x] HTTP git-upload-pack (smart clone/fetch)
- [x] Draft pull requests
- [x] User-created Resonance fields (communities)
- [x] Squash/rebase merge + inline PR review comments
- [x] Repo file blame and revision history in Code tab
- [x] Coolify webhook / auto-redeploy doc (COOLIFY.md)
- [ ] Per-route SEO (OG images)
