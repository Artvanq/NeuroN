# Neuron — деплой с нулевыми вложениями (кроме сервера)

Целевой режим: **один VPS** (~$5–7/мес), всё остальное self-hosted в Docker. Без Railway, Upstash, Supabase, R2 и Resend на старте.

## Что крутится на сервере

| Компонент | Где | Платно? |
|-----------|-----|---------|
| PostgreSQL | контейнер `postgres` | нет (диск VPS) |
| Redis | контейнер `redis` | нет |
| API + Socket.io | контейнер `api` | нет |
| Workers | `analytics-worker`, `digest-worker` | нет |
| Frontend | контейнер `web` | нет |
| Медиа (аватары, вложения) | volume `neuron_media` → `MEDIA_LOCAL_DIR` | нет |
| HTTPS | Caddy/nginx на хосте | нет (Let's Encrypt) |

## Что **не** нужно на старте

- Cloudflare R2 — вместо него `MEDIA_STORAGE=local`
- Resend — `REQUIRE_EMAIL_VERIFICATION=false` (логин без письма; reset по email позже)
- Turnstile — регистрация без captcha, если ключи пустые
- Sentry — опционально
- ClickHouse — analytics worker пишет в outbox; ClickHouse не обязателен
- Отдельный managed Redis/Postgres

## Быстрый старт на VPS

```bash
# 1. Клонировать репозиторий на сервер
git clone <repo> neuron && cd neuron

# 2. Env
cp .env.example .env
# Отредактировать: POSTGRES_PASSWORD, JWT_SECRET, CHAT_ENCRYPTION_KEY, домены

# 3. Запуск
docker compose -f docker-compose.prod.yml up -d --build

# 4. Миграции (первый раз)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# 5. Проверка
curl -s http://127.0.0.1:4000/api/health
# → media: "local", postgres/redis connected
```

## HTTPS (рекомендуется)

Пример Caddy — [deploy/Caddyfile](../deploy/Caddyfile):

```bash
sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
# Подставить домены, перезапустить caddy
sudo systemctl reload caddy
```

Проксируйте:

- `example.com` → `localhost:3000` (web)
- `api.example.com` → `localhost:4000` (api)

В `.env`: `FRONTEND_URL`, `API_PUBLIC_URL`, `NEXT_PUBLIC_*` с `https://`.

## Бэкапы (только cron на сервере)

```bash
export DATABASE_URL=postgresql://neuron:PASSWORD@localhost:5432/neuron
./scripts/backup-postgres.sh
```

Медиа: периодический `tar` volume `neuron_media` или rsync каталога `/var/lib/docker/volumes/...`.

## Когда понадобится «внешний» сервис (всё ещё можно бесплатно)

| Задача | Бесплатный вариант |
|--------|-------------------|
| Email verify / reset | [Resend](https://resend.com) free tier |
| Медиа + CDN | Cloudflare R2 free tier |
| Redis backup | оставить на VPS или Upstash free |
| Ошибки | Sentry free tier |

Переключение медиа на R2: заполнить `R2_*`, установить `MEDIA_STORAGE=r2`.

## Ограничения budget-режима

- Нет исходящей почты → без verify-email и password-reset по email
- Медиа отдаются с API (`/api/media/files/...`) — нагрузка на диск и CPU сервера
- Один сервер — нет горизонтального масштабирования без второго узла

Подробнее общий deploy: [DEPLOY.md](./DEPLOY.md).
