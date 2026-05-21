# Neuron — запуск проекта

## Рекомендуемый прод: Coolify на одном VPS

**Шаблоны env:** [`.env.example`](.env.example) (корень / compose), [`neuron_backend/neuron_backend/.env.example`](neuron_backend/neuron_backend/.env.example) (полный API), [`.env.coolify.example`](.env.coolify.example), [`neuron_frontend/.env.local.example`](neuron_frontend/.env.local.example)  
**Инструкция:** [docs/COOLIFY.md](docs/COOLIFY.md) (чеклист до/после деплоя, `npm run verify:deploy`)

- Текстовый v1: `MEDIA_STORAGE=disabled` (медиа позже)
- Email verify: **Resend** + `REQUIRE_EMAIL_VERIFICATION=true`
- Postgres + Redis — плагины Coolify на том же сервере

## Альтернатива: один VPS без Coolify ($0 SaaS)

**План:** платите только за сервер; Postgres, Redis, API, workers, frontend и медиа — на том же хосте в Docker.

| Компонент | Где | Стоимость |
|-----------|-----|-----------|
| PostgreSQL | Docker `postgres` | $0 |
| Redis | Docker `redis` | $0 |
| Медиа | диск VPS (`MEDIA_STORAGE=local`) | $0 |
| API + workers + web | Docker | $0 |
| HTTPS | Caddy + Let's Encrypt | $0 |

**Старт:** [docs/BUDGET-DEPLOY.md](docs/BUDGET-DEPLOY.md) → `cp .env.budget.example .env` → `docker compose -f docker-compose.prod.yml up -d --build`

Проверка: `GET /api/health` → `postgres`, `redis`, `media: local`, `auth`.

### Медиа (local или R2)

1. **Budget:** `MEDIA_STORAGE=local`, `MEDIA_LOCAL_DIR=/data/media` — PUT на `/api/media/:id/upload`, раздача `/api/media/files/...`
2. **Позже (free tier):** Cloudflare R2 → `R2_*`, `MEDIA_STORAGE=r2` — presign + PUT на R2

### Опциональные free-tier SaaS (не обязательны)

| Сервис | Зачем |
|--------|--------|
| Resend Free | email verify, password reset, digest |
| Cloudflare R2 | CDN для медиа |
| Sentry Free | алерты по ошибкам |

Переменные — [`.env.example`](.env.example) / [`.env.budget.example`](.env.budget.example) и [`neuron_backend/neuron_backend/.env.example`](neuron_backend/neuron_backend/.env.example).

### Альтернатива: managed (если не один VPS)

| Сервис | Провайдер |
|--------|-----------|
| PostgreSQL | Supabase Free |
| Redis | Upstash Free |
| Файлы | Cloudflare R2 |
| API | Railway / Render |

См. также [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Что нужно (локально)

| Компонент | Версия |
|-----------|--------|
| Node.js | 18+ |
| PostgreSQL | Docker (рекомендуется) или свой инстанс |

> Порт **5433** на хосте — чтобы не конфликтовать с другими Postgres в Docker (например `onrav-postgres` на 5432).

---

## Docker (Postgres + API)

```powershell
cd D:\WORK\Neuron
docker compose up -d postgres
```

Схема БД (локально, без Docker API):

```powershell
cd D:\WORK\Neuron\neuron_backend\neuron_backend
copy .env.example .env
npm install
npm run db:migrate:deploy
npm start
```

Полный стек: `docker compose up` (Postgres + API + frontend + workers).

---

## Быстрый старт

```powershell
# 1 — Postgres
cd D:\WORK\Neuron
docker compose up -d postgres

# 2 — API (порт 4000)
cd D:\WORK\Neuron\neuron_backend\neuron_backend
copy .env.example .env
npm install
npm run db:push
npm start

# 3 — сайт (порт 3000)
cd D:\WORK\Neuron\neuron_frontend
npm install
npm run dev
```

Откройте http://localhost:3000

### Демо-пользователи

В `neuron_backend\neuron_backend\.env`:

```
SEED_DEMO=true
```

Перезапустите backend. Логины: `physicist` / `poet`, пароль: `demo1234`

---

## База данных

### Docker (по умолчанию)

```
DATABASE_URL=postgresql://neuron:neuron@127.0.0.1:5433/neuron
```

Контейнер: `neuron-postgres` (`postgres:16-alpine`).

### Свой PostgreSQL / облако

В `.env`:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/neuron
JWT_SECRET=сгенерируйте-длинную-случайную-строку-минимум-32-символа
FRONTEND_URL=http://localhost:3000
SEED_DEMO=true
```

После смены схемы: `npm run db:push` или `npm run db:migrate`.

---

## Frontend env

```powershell
cd D:\WORK\Neuron\neuron_frontend
copy .env.local.example .env.local
```

По умолчанию API: `http://localhost:4000`. Меняйте только если backend на другом хосте:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Production checklist

**Backend** (`NODE_ENV=production`):

- `DATABASE_URL` — обязателен
- `JWT_SECRET` — минимум 32 случайных символа, не дефолт из example
- `JWT_SECRET_ROTATION_DAYS` — опционально: предупреждение в логах, если секрет не менялся N дней
- `FRONTEND_URL` — URL вашего Next.js (например `https://neuron.place`)
- `REDIS_URL` — обязателен для refresh-сессий и rate limit
- `RESEND_API_KEY` + `RESEND_FROM` — для verify/reset/email-уведомлений
- `REQUIRE_EMAIL_VERIFICATION=true` — опционально: запрет логина до подтверждения email
- `ALLOW_USER_COMMUNITIES=true` или `FEATURE_FLAGS=user_communities` — создание полей пользователями (в dev включено по умолчанию; в prod задайте явно)
- `CAPTCHA_SECRET` — включает captcha-проверку на `POST /api/auth/register`
- `REPORT_CAPTCHA_SECRET` — отдельная captcha-проверка для `POST /api/reports` (если не задан, используется `CAPTCHA_SECRET`)
- `REPORT_ABUSE_BLOCK_THRESHOLD` — порог блокировки репортов за abuse-score
- `REPORT_ABUSE_DECAY_HOURS` — скорость автоматического снижения abuse-score
- `CLICKHOUSE_URL` (+ `CLICKHOUSE_TABLE`) — опционально для аналитики
- Применяйте миграции командой `npm run db:migrate:deploy` (не только `db:push`)
- Отдельно запустите workers: `npm run worker:analytics`, `npm run worker:digest`

**Frontend**:

- `NEXT_PUBLIC_API_URL` — URL API (например `https://api.neuron.place`)
- `NEXT_PUBLIC_CAPTCHA_SITE_KEY` — site key для Turnstile в форме регистрации

---

## API endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Статус сервисов (postgres, redis, r2, auth, gitSsh, webPush) |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход (при включённом 2FA — поле `totpCode`; без него `code: totp_required`) |
| GET/POST | `/api/auth/2fa/*` | TOTP 2FA: status, setup, enable, disable |
| GET/POST/DELETE | `/api/auth/tokens` | Personal access tokens (`nrn_…`) |
| GET/POST/DELETE | `/api/auth/ssh-keys` | SSH public keys for git |
| GET | `/api/categories` | Поля наук |
| POST | `/api/categories` | Создать поле (community); лимит 10 на пользователя |
| GET | `/api/categories/mine/list` | Мои созданные поля |
| PATCH | `/api/categories/:slug` | Описание, иконка, цвет (мод поля) |
| GET | `/api/threads` | Вопросы |
| POST | `/api/threads` | Создать (auth) |
| GET | `/api/threads/:id/replies` | Ответы |
| GET | `/api/conversations` | Диалоги (auth) |
| GET/PUT | `/api/threads/:id/synthesis` | Shared emergence |
| GET | `/api/threads?lens=seeking\|collision` | Ленты резонанса |
| PATCH | `/api/auth/me` | Профиль, поля, mind statement, `notificationPreferences` |
| GET | `/api/notifications` | Уведомления (auth) |
| GET/POST | `/api/orgs` | Список / создание организации |
| GET | `/api/orgs/:slug` | Профиль организации |
| GET/POST/DELETE | `/api/orgs/:slug/members` | Участники организации |
| POST | `/api/projects/:owner/:slug/fork` | Форк проекта в личный namespace |
| GET/POST/DELETE | `/api/projects/:owner/:slug/labels` | Метки issues |
| PATCH | `/api/projects/:owner/:slug/issues/:n` | Обновить issue (`labelIds[]`) |
| GET | `/api/media/config` | `{ enabled, mode }` — сейчас обычно disabled |
| GET | `/api/push/config` | VAPID public key и флаг `enabled` |
| GET | `/api/push/subscriptions` | Подписки push текущего пользователя (auth) |
| POST | `/api/push/subscribe` | Сохранить Web Push subscription (auth) |
| DELETE | `/api/push/subscribe` | Отписать endpoint (auth) |
| GET | `/api/search?q=` | Поиск вопросов, умов, проектов и (для auth) сообщений |
| GET/POST | `/api/projects/:owner/:slug/collaborators` | Список / добавление collaborators |
| PATCH/DELETE | `/api/projects/:owner/:slug/collaborators/:userId` | Обновить роль / удалить collaborator |
| GET/PATCH | `/api/projects/:owner/:slug/protection` | Branch protection (по `branch`, default `main`) |
| POST | `/api/projects/:owner/:slug/pulls/:n/merge` | Merge PR (`mergeMethod`: merge \| squash \| rebase) |
| POST | `/api/projects/:owner/:slug/pulls/:n/reviews` | Approve / request changes / comment |
| GET/POST/PATCH/DELETE | `/api/projects/:owner/:slug/pulls/:n/comments` | Inline review comments on diff lines |
| GET | `/api/projects/:owner/:slug/blame` | Blame по строкам (`path`, `branch`) |
| GET | `/api/projects/:owner/:slug/history` | История сохранений файла |
| GET | `/api/projects/:owner/:slug/history/:revisionId` | Содержимое ревизии |
| PATCH | `/api/categories/:slug/rules` | Правила поля (category mod / platform mod) |
| GET/POST/DELETE | `/api/categories/:slug/moderators` | Модераторы поля |
| POST | `/api/conversations/:id/read` | Read receipt |
| PATCH/DELETE | `/api/conversations/:id/messages/:mid` | Edit / delete message |
| POST/DELETE | `.../messages/:mid/reactions` | Reactions |
| POST | `/api/reports` | Жалоба на контент |
| GET | `/api/reports` | Очередь жалоб (mod) |
| PATCH | `/api/reports/:id` | Решение по жалобе (mod) |
| GET | `/api/reports/log` | Audit log модерации (mod) |
| GET | `/api/reports/export` | Полный экспорт модерации (mod) |
| GET | `/api/reports/export.csv` | CSV-экспорт модерации (mod) |
| POST | `/api/appeals` | Апелляция на бан |
| GET | `/api/appeals/me` | Статус санкции и история апелляций |
| GET | `/api/appeals` | Очередь апелляций (mod) |
| PATCH | `/api/appeals/:id` | Решение по апелляции (mod) |
| POST | `/api/auth/password/forgot` | Запрос reset-письма |
| POST | `/api/auth/password/reset` | Сброс пароля по токену |
| POST | `/api/auth/email/verify/request` | Отправить verify email (авторизован) |
| POST | `/api/auth/email/verify/request-public` | Повтор verify по username/email (без сессии) |
| POST | `/api/auth/email/verify/confirm` | Подтвердить email |
| DELETE | `/api/auth/oauth/unlink/:provider` | Отвязать OAuth-провайдера |
| GET | `/api/auth/sessions` | Список активных сессий |
| DELETE | `/api/auth/sessions/:jti` | Ревок отдельной сессии |
| POST | `/api/auth/sessions/revoke-all` | Ревок всех сессий |
| GET | `/api/auth/export` | GDPR-экспорт аккаунта |
| DELETE | `/api/auth/account` | Удаление аккаунта |
| GET | `/api/git/:owner/:slug` | Git metadata (bundle + info/refs URLs) |
| GET | `/api/git/:owner/:slug/clone.bundle` | Read-only git bundle export (нужен `git` на сервере) |
| POST | `/api/git/:owner/:slug/git-upload-pack` | Smart HTTP clone/fetch (auth for private repos) |
| POST | `/api/git/:owner/:slug/git-receive-pack` | Smart HTTP git push (Basic auth, WRITE+) |
| WebSocket | Socket.io на том же порту | Чат и уведомления в реальном времени |

Полная спецификация API: `docs/openapi.yaml`.
Архитектура: `docs/architecture.md`.
Roadmap: `docs/roadmap.md`. **Статус по полному плану:** `docs/STATUS.md`.  
**Launch checklist:** `docs/LAUNCH.md`.

### Модерация и RBAC

Роли хранятся в `users.platform_role` (`MEMBER` | `MODERATOR` | `ADMIN`). Права:

| Роль | Права |
|------|--------|
| `MEMBER` | — |
| `MODERATOR` | `moderation.read`, `moderation.write`, `moderation.export` |
| `ADMIN` | всё выше + `site.admin` (статистика `/owner/stats`) |

При старте API env `MODERATOR_USERNAMES` и `SITE_OWNER_USERNAME` синхронизируются в БД (без понижения уже назначенных ролей). Env остаётся fallback, если в БД ещё `MEMBER`.

Доступ к `GET/PATCH /api/reports`, export и audit — у пользователей с `moderation.*`.

Форматы `targetId` для репортов:
- `project`: `owner/slug`
- `file`: `owner/slug:path/to/file.ext`

### Санкции и апелляции

- При бане login/refresh возвращают `403` с `code: account_banned`, `bannedReason`, `bannedAt`, `canAppeal`.
- `POST /api/appeals` — подать апелляцию (username+password для забаненных без сессии, либо Bearer для забаненного токена).
- `GET /api/appeals/me` — статус санкции и история апелляций.
- `GET /api/appeals` / `PATCH /api/appeals/:id` — очередь и решение модератора (accept снимает бан).
- UI: `/sanctions/appeal`, inbox модератора на `/moderation` (алиас `/owner/reports`): очередь жалоб, ban appeals, audit log, export JSON/CSV.

### Настройки уведомлений

- Поле `users.notification_preferences` (JSON): каналы `inApp` и `email` по типам (`reply`, `vote`, `message`, `message_request`, `message_request_accepted`, `message_request_declined`, `project_pr_opened`, `project_pr_review`, `project_issue_opened`, `project_ci_success`, `project_ci_failure`, `synthesis_update`, `moderation_warning`) и флаг `email.digest`.
- `GET /api/auth/me` возвращает нормализованный объект `notificationPreferences`.
- `PATCH /api/auth/me` принимает частичный `notificationPreferences`; отключённые каналы не создают in-app уведомления и не отправляют email (digest worker учитывает `email.digest`).
- UI: раздел **Notification preferences** на `/settings`.

### Two-factor authentication (TOTP)

- Включение: `/settings` → **Two-factor authentication** → setup → код из authenticator app.
- При входе с включённым 2FA API возвращает `401` с `code: totp_required` до передачи `totpCode` в `POST /api/auth/login`.
- Отключение: код из app + пароль (если аккаунт с паролем).
- **Personal access tokens** (`nrn_…`) продолжают работать для git/API при включённом 2FA.

### Personal access tokens

- Создание: `/settings` → **Personal access tokens** → Generate token.
- Scopes: `git:read`, `git:write`, `api:read` (по умолчанию git read/write).
- Git push: `git push https://USERNAME:nrn_TOKEN@host/api/git/owner/slug branch`
- API: `Authorization: Bearer nrn_TOKEN` (нужен scope `api:read`).
- Токен показывается один раз при создании; в БД хранится только hash.

### Git clone

- На странице проекта: ZIP, **git bundle**, команда `git clone …/clone.bundle`.
- API: `GET /api/git/:owner/:slug`, `clone.bundle`, `info/refs`.
- На сервере должен быть установлен `git` в PATH.

### Git push (smart HTTP)

- Remote URL: `https://api.example.com/api/git/{owner}/{slug}`
- Auth: HTTP Basic (`username` + `password`, или **PAT** `nrn_…` как password)
- Push: `git push https://USER:PASS@host/api/git/owner/slug HEAD:branch`
- Защищённые ветки (например `main`) принимают push только от **MAINTAINER**+; остальным — через PR
- После push запускается CI (`triggerCi`) как при web-редакторе

### Git over SSH

- Включение: задайте `SSH_GIT_PORT` (по умолчанию dev: **2222**). Сервер стартует вместе с API.
- Remote: `ssh://git@localhost:2222/owner/slug.git` (см. Clone panel на странице проекта).
- Auth: **SSH public key** из Settings, или PAT как SSH password.
- Host key: `SSH_GIT_HOST_KEY_PATH` или `SSH_GIT_HOST_KEY` (PEM). Без них — ephemeral key (только dev).
- Docker: порт `2222:2222` проброшен в `docker-compose.yml`.

### PWA

Сайт можно установить на телефон (manifest + service worker в production).

### Worker-процессы

- `worker:analytics` читает `analytics_outbox` и отправляет в ClickHouse (если настроен).
- `worker:digest` отправляет daily digest по непрочитанным уведомлениям.

### Sentry (ошибки и алерты)

Опционально, но рекомендуется в production:

| Сервис | Переменная | Где инициализируется |
|--------|------------|----------------------|
| API | `SENTRY_DSN` | `utils/sentry.js` → `index.js` |
| Workers | `SENTRY_DSN` | `workers/*` (тот же DSN или отдельный project) |
| Frontend | `NEXT_PUBLIC_SENTRY_DSN` | `lib/sentry.js` → `_app.js` |

Дополнительно: `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` (по умолчанию `0.1` в prod API, `0` в dev).

Чувствительные поля (`password`, `token`, `authorization`, …) фильтруются в `beforeSend`. Без DSN reporting отключён — в production API пишет предупреждение при старте.

В Sentry UI настройте alert rules (например, spike в `500` или новый issue в `neuron-api`).

### Переклад контенту

У шапці — вибір мови (прапорець + код), як на Binance: пости та відповіді перекладаються обраною мовою. **Original** — текст як написано. Налаштування зберігаються в браузері та в профілі (якщо ви увійшли).

---

## Проблемы

| Симптом | Решение |
|---------|---------|
| CORS error | Проверьте `FRONTEND_URL` на backend |
| 401 на всех запросах | Перелогиньтесь, проверьте `JWT_SECRET` не менялся |
| `DATABASE_URL is required` | Запустите `docker compose up -d postgres`, скопируйте `.env.example` → `.env` |
| `connection refused` на 5433 | `docker compose up -d postgres`, подождите healthcheck |
| Порт 5433 занят | В `docker-compose.yml` смените `5433:5432`, обновите URL в `.env` |
| Порт 4000 занят | В `.env`: `PORT=4001` и во frontend `NEXT_PUBLIC_API_URL` |
| `EPERM` / `query_engine-windows.dll.node` при `npm install` | Зупиніть `npm start` (API), потім `npm run prisma:generate`. Не запускайте install, поки backend працює |
