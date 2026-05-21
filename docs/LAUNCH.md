# Neuron — Launch checklist

Пошаговый чеклист, чтобы вывести проект в production. Код готов; ниже — что **настроить с вашей стороны**.

## 1. Инфраструктура

### Budget (один VPS, см. [BUDGET-DEPLOY.md](./BUDGET-DEPLOY.md))

- [ ] VPS + Docker
- [ ] `cp .env.example .env` — пароли, `JWT_SECRET`, домены
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] `MEDIA_STORAGE=local` (медиа на диске сервера)
- [ ] `REQUIRE_EMAIL_VERIFICATION=false` до подключения почты
- [ ] Caddy/nginx + Let's Encrypt (опционально, бесплатно)

### Опционально позже (free tier)

- [ ] **Resend** — verify email, password reset
- [ ] **R2** — CDN для медиа (`MEDIA_STORAGE=r2`)
- [ ] **Turnstile** — captcha на регистрации
- [ ] **Sentry** — алерты

### Managed-альтернатива

- [ ] PostgreSQL — Supabase / Neon / RDS
- [ ] Redis — Upstash или свой
- [ ] Домены — `FRONTEND_URL`, `API_PUBLIC_URL`, `NEXT_PUBLIC_*`

## 2. Backend `.env` (production)

Скопируйте `.env.example` в `.env` в корне репозитория и заполните ключи из production checklist в `SETUP.md`.

Обязательно:

```
NODE_ENV=production
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
CHAT_ENCRYPTION_KEY=...
RESEND_API_KEY=...
RESEND_FROM=...
REQUIRE_EMAIL_VERIFICATION=true
MEDIA_SCAN_URL=https://scanner.example.com/scan   # optional but recommended
MEDIA_SCAN_TOKEN=...
R2_* (все четыре)
FRONTEND_URL=https://your-domain.com
API_PUBLIC_URL=https://api.your-domain.com
SSH_GIT_HOST_KEY_PATH=/run/secrets/ssh_host_key   # если git по SSH
SSH_GIT_PORT=2222
SSH_GIT_HOST=git.your-domain.com
MODERATOR_USERNAMES=...
SITE_OWNER_USERNAME=...
```

## 3. Frontend env

`NEXT_PUBLIC_*` в корневом `.env` (см. [ENV.md](./ENV.md)). После смены — rebuild фронта.

## 4. База данных

```bash
cd neuron_backend/neuron_backend
npm ci
npx prisma generate
npm run db:migrate:deploy   # production (миграции в prisma/migrations/)
# dev (без истории миграций): npm run db:push
```

## 5. Процессы

| Процесс | Команда |
|---------|---------|
| API | `npm start` |
| Analytics worker | `npm run worker:analytics` |
| Digest worker | `npm run worker:digest` |
| Frontend | `npm run build && npm start` |

Docker: `docker compose up -d` (postgres, redis, api, workers, web).

## 6. Git для пользователей

- HTTP: `https://api…/api/git/owner/slug` + PAT (`nrn_…`)
- SSH: `ssh://git@host:2222/owner/slug.git` + ключ из Settings

## 7. Бэкапы и ops (вне репозитория)

Полный runbook: **[PRODUCTION-OPS.md](./PRODUCTION-OPS.md)**.

- Postgres: `scripts/backup-postgres.sh` + `npm run ops:backup-cron`
- R2 lifecycle: `scripts/r2-lifecycle-rules.example.json`
- Sentry alerts: `docs/ops/SENTRY-ALERTS.md`
- VAPID: `npm run ops:vapid`
- Post-deploy: `npm run verify:deploy -- https://api.yourdomain.com`

## 8. Smoke после деплоя

```bash
npm run verify:deploy -- https://api.yourdomain.com
```

- [ ] `GET /api/health` → `status: ok`, `analytics` / `webPush` как ожидаете
- [ ] Register → verify email → login
- [ ] Create thread + project
- [ ] `git clone` / push (если SSH включён)
- [ ] Moderation inbox (`/moderation`) под mod-аккаунтом

## 9. Опционально / post-v1

- **Native git objects** (packfiles) — DB-backed repos сейчас
- **LinkedIn-parity** — отдельный продуктовый эпик
- **Web Push:** `VAPID_*` + Settings → browser notifications
- **Organizations & forks:** миграция `20260521000000_organizations_and_forks`, API `/api/orgs`, `POST …/fork`
- **Deploy:** [DEPLOY.md](./DEPLOY.md), Railway configs в `deploy/railway/`
- **Load smoke:** `npm run test:load` в backend CI
