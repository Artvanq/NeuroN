# Neuron — Deployment guide

Пошаговый деплой API, workers, frontend и миграций.

**Если бюджет = только сервер:** начните с **[BUDGET-DEPLOY.md](./BUDGET-DEPLOY.md)** (`docker-compose.prod.yml`, локальные медиа, без R2/Resend).

## Варианты

| Вариант | Когда использовать |
|---------|-------------------|
| **Budget VPS** | Один сервер, $0 SaaS — [BUDGET-DEPLOY.md](./BUDGET-DEPLOY.md) |
| **Docker Compose (dev)** | Локальная разработка |
| **Railway** | Managed PaaS (платно / лимиты) |
| **GitHub Actions** | CI + ручной deploy по тегу |

## 1. Docker Compose (production-like)

```bash
# .env в корне репозитория (см. docker-compose.yml + neuron_backend/.../.env.example)
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
curl -s http://localhost:4000/api/health
```

Сервисы: `postgres`, `redis`, `api`, `analytics-worker`, `digest-worker`, `web`.

## 2. Railway (monorepo)

Создайте **5 сервисов** в одном проекте Railway, привязав корень репозитория и конфиги из `deploy/railway/`:

| Сервис | Config path | Root directory |
|--------|-------------|----------------|
| API | `deploy/railway/api.railway.toml` | `neuron_backend/neuron_backend` |
| Analytics worker | `deploy/railway/analytics-worker.railway.toml` | `neuron_backend/neuron_backend` |
| Digest worker | `deploy/railway/digest-worker.railway.toml` | `neuron_backend/neuron_backend` |
| Web | `deploy/railway/web.railway.toml` | `neuron_frontend` |

**Плагины:** PostgreSQL, Redis — подключите `DATABASE_URL` и `REDIS_URL` к API и workers.

**Обязательные переменные API:** см. `neuron_backend/neuron_backend/.env.example` и [LAUNCH.md](./LAUNCH.md).

**Web:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, build-time env.

После первого деплоя API:

```bash
railway run --service api npx prisma migrate deploy
```

Healthcheck: `GET /api/health` → `status: ok`.

## 3. GitHub Actions deploy

Workflow `.github/workflows/deploy.yml`:

- Запускается на тег `v*` или вручную (`workflow_dispatch`).
- Прогоняет backend tests + frontend build + e2e.
- Job `migrate` проверяет применение миграций к Postgres (service container).
- Job `deploy` — placeholder: подключите Railway/Vercel/Fly через secrets (`RAILWAY_TOKEN` и т.д.).

Секреты (пример для Railway CLI):

- `RAILWAY_TOKEN` — токен проекта
- `DATABASE_URL` — только для migrate job в CI (опционально)

## 4. Миграции

Production **всегда**:

```bash
cd neuron_backend/neuron_backend
npx prisma migrate deploy
```

Не используйте `db:push` в production.

## 5. Бэкапы Postgres

Скрипт `scripts/backup-postgres.sh` (требует `pg_dump` и `DATABASE_URL`):

```bash
export DATABASE_URL=postgresql://...
./scripts/backup-postgres.sh
# → backups/neuron-YYYYMMDD-HHMMSS.sql.gz
```

Рекомендуется cron daily + PITR у managed-провайдера.

## 6. Smoke после деплоя

```bash
curl -s "$API_PUBLIC_URL/api/health" | jq .
```

Чеклист UI: [LAUNCH.md §8](./LAUNCH.md#8-smoke-после-деплоя).

## 7. Load smoke (CI)

`npm run test:load` в backend — лёгкая проверка latency на `/api/health` (не полноценный k6).
