# Neuron on Coolify

Деплой на **один VPS через Coolify**: Postgres + Redis как плагины, приложения как отдельные сервисы.  
**v1 — только текст:** медиа отключены (`MEDIA_STORAGE=disabled`). **Email verify** — через **Resend**.

**Операционный runbook (бэкапы, VAPID, ClickHouse, legal, verify):** [PRODUCTION-OPS.md](./PRODUCTION-OPS.md).

Env: один файл в корне репозитория — [`.env.example`](../.env.example) → скопируйте в `.env` локально или вставьте ключи в Coolify UI (api, web, workers).

## Сервисы в Coolify

| Сервис | Root / Dockerfile | Start command |
|--------|-------------------|---------------|
| **postgres** | Coolify Postgres plugin | — |
| **redis** | Coolify Redis plugin | — |
| **api** | `neuron_backend/neuron_backend` | `npx prisma migrate deploy && node index.js` |
| **web** | `neuron_frontend` | `npm start` (after `npm run build`) |
| **analytics-worker** | `neuron_backend/neuron_backend` | `npm run worker:analytics` |
| **digest-worker** | `neuron_backend/neuron_backend` | `npm run worker:digest` |

## Обязательные переменные (API)

Минимум для prod — см. [`.env.example`](../.env.example).

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<32+ random>
CHAT_ENCRYPTION_KEY=<32+ random>
API_PUBLIC_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
RESEND_API_KEY=re_...
RESEND_FROM=Neuron <noreply@yourdomain.com>
REQUIRE_EMAIL_VERIFICATION=true
MEDIA_STORAGE=disabled
MODERATOR_USERNAMES=<your username>
SITE_OWNER_USERNAME=<your username>
ALLOW_USER_COMMUNITIES=true
```

## Frontend (build-time!)

В Coolify для **web** задайте **Build Arguments**:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

И те же значения в runtime env.

## Resend

1. Домен в Resend → DNS records  
2. `RESEND_API_KEY` + `RESEND_FROM` на API и digest-worker  
3. `REQUIRE_EMAIL_VERIFICATION=true` — иначе логин без подтверждённого email не пройдёт  

Проверка: регистрация → письмо → `/verify-email?token=...` → логин.

## Миграции

После первого деплоя API (или one-off command в Coolify):

```bash
npx prisma migrate deploy
```

Новые миграции: `20260523000000_visibility_milestones_assignees` (project visibility, milestones, assignees, `threads.is_locked`).

Health: `GET https://api.yourdomain.com/api/health` → `postgres`, `redis`, `media: "disabled"`.

## Домены в Coolify

- `yourdomain.com` → web:3000  
- `api.yourdomain.com` → api:4000  

CORS: `FRONTEND_URL` должен совпадать с origin фронта.

## Workers

- **analytics-worker** — только `DATABASE_URL` (ClickHouse опционально)  
- **digest-worker** — `DATABASE_URL`, `RESEND_*`, `FRONTEND_URL`  

## Что включить позже

| Фича | Env |
|------|-----|
| Медиа R2 / local | `MEDIA_STORAGE`, `R2_*` или `MEDIA_LOCAL_DIR` |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Turnstile | `CAPTCHA_SECRET`, `REPORT_CAPTCHA_SECRET`, `NEXT_PUBLIC_CAPTCHA_SITE_KEY` |
| Sentry | `SENTRY_DSN`, `SENTRY_*`, `NEXT_PUBLIC_SENTRY_DSN` |
| User communities | `ALLOW_USER_COMMUNITIES=true` или `FEATURE_FLAGS=user_communities` |
| Git SSH | `SSH_GIT_PORT`, `SSH_GIT_HOST`, `SSH_GIT_HOST_KEY_PATH` |
| ClickHouse analytics | `CLICKHOUSE_URL`, `CLICKHOUSE_TABLE` (analytics-worker) |
| OAuth | `GITHUB_*`, `REDDIT_*`, `LINKEDIN_*` |

См. также [BUDGET-DEPLOY.md](./BUDGET-DEPLOY.md) (один compose без Coolify).

## Чеклист перед первым деплоем

- [ ] Postgres и Redis созданы в Coolify, `DATABASE_URL` / `REDIS_URL` скопированы в **api**, **analytics-worker**, **digest-worker**
- [ ] `JWT_SECRET` и `CHAT_ENCRYPTION_KEY` — случайные строки ≥ 32 символов (не из примеров)
- [ ] `API_PUBLIC_URL` и `FRONTEND_URL` — финальные HTTPS-URL (без слэша в конце)
- [ ] Resend: домен верифицирован, `RESEND_API_KEY`, `RESEND_FROM` на **api** и **digest-worker**
- [ ] `REQUIRE_EMAIL_VERIFICATION=true`, `MEDIA_STORAGE=disabled`
- [ ] **web**: build args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` совпадают с runtime
- [ ] Домены: `yourdomain.com` → web, `api.yourdomain.com` → api
- [ ] Start command **api**: `npx prisma migrate deploy && node index.js`

## Чеклист после деплоя

```bash
chmod +x scripts/verify-deploy.sh scripts/install-backup-cron.sh
npm run verify:deploy -- https://api.yourdomain.com
```

Опционально после включения VAPID / ClickHouse:

```bash
VERIFY_EXPECT_WEB_PUSH=1 npm run verify:deploy -- https://api.yourdomain.com
VERIFY_EXPECT_ANALYTICS=clickhouse npm run verify:deploy -- https://api.yourdomain.com
```

Legal на **web** (build + runtime): `NEXT_PUBLIC_LEGAL_OPERATOR`, `NEXT_PUBLIC_LEGAL_CONTACT` — см. [PRODUCTION-OPS.md](./PRODUCTION-OPS.md) §1.

Ожидаемый фрагмент `GET /api/health`:

```json
{
  "status": "ok",
  "services": {
    "postgres": "connected",
    "redis": "connected",
    "media": "disabled",
    "email": "verification_required"
  }
}
```

Ручные проверки:

| Шаг | Действие | Ожидание |
|-----|----------|----------|
| 1 | Открыть `https://yourdomain.com` | Главная без ошибок в консоли |
| 2 | Регистрация нового пользователя | Письмо Resend на inbox |
| 3 | Ссылка из письма → `/verify-email` | Email подтверждён |
| 4 | Логин без verify (другой тестовый аккаунт) | `email_verification_required` + resend |
| 5 | Создать тред / issue / DM | Только текст, без кнопки «Attach media» |
| 6 | `GET /api/media/config` | `{ "enabled": false, "mode": "disabled" }` |
| 7 | Workers в Coolify — Running | analytics + digest без рестартов |

Если `email: verification_required_missing_resend` — добавьте `RESEND_*` и перезапустите API.

## Auto-redeploy (GitHub webhook)

Чтобы Coolify пересобирал стек после push в `main`:

1. В Coolify откройте приложение → **Webhooks** → скопируйте URL deploy hook.
2. В GitHub: **Settings → Webhooks → Add webhook**
   - **Payload URL**: URL из Coolify
   - **Content type**: `application/json`
   - **Events**: «Just the push event» (или выборочно `push` на `main`)
3. После push дождитесь зелёного деплоя, затем на VPS (или из CI с `DEPLOY_API_URL`):

```bash
npm run verify:deploy
```

Миграции при новых релизах (one-off в контейнере API):

```bash
npx prisma migrate deploy
```

Новые миграции в этой ветке: `20260524000000_templates_stars_pins`, `20260525000000_issue_comments`.

## Issues: метки и доски

В настройках проекта создайте **Labels**, на вкладке **Issues**:

- **List** — фильтр open/closed/all + метки  
- **Board** — колонки Open / Closed  
- **Labels** — колонки по меткам (только open issues)

## Troubleshooting

| Симптом | Решение |
|---------|---------|
| CORS / 401 на логине | `FRONTEND_URL` = origin фронта |
| Письма не приходят | Resend DNS, `RESEND_FROM` с верифицированного домена |
| `status: degraded` | Postgres/Redis URL или сеть между сервисами |
| Миграции | One-off: `npx prisma migrate deploy` в каталоге API |
| Старые вложения в UI | Нормально; загрузка новых отключена при `MEDIA_STORAGE=disabled` |
