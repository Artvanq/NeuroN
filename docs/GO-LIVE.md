# Neuron — запуск у прод з автодеплоєм

Мета: сайт працює на сервері, а кожен `git push` у `main` автоматично оновлює прод.

Платформа (код) готова. Нижче — лише ті кроки, які можу зробити **тільки ти** (сервер,
секрети, домен). Кроки 1–6 робляться один раз, далі деплой автоматичний.

---

## Як це працює після налаштування

```
git push origin main
        │
        ▼
GitHub Actions (.github/workflows/deploy.yml)
  1. verify     — тести бекенду + build фронта + E2E smoke
  2. migrate    — перевірка міграцій Prisma
  3. load-smoke — навантажувальний smoke
  4. deploy     — дзвонить у Coolify webhook → Coolify тягне новий код,
                  перебудовує контейнери, виконує prisma migrate deploy,
                  далі health-check /api/health з ретраями
```

Якщо тести червоні — деплою не буде (прод не зламається).

---

## 1. Сервер + Coolify

1. Орендуй VPS (мінімум 2 vCPU / 4 GB RAM для старту).
2. Встанови **Coolify** (https://coolify.io) — одна команда на свіжому Ubuntu.
3. У Coolify створи проєкт і додай плагіни **Postgres** та **Redis**.
   Скопіюй їхні `DATABASE_URL` і `REDIS_URL`.

## 2. Сервіси в Coolify

Підключи цей GitHub-репозиторій і створи 4 сервіси (root / start command):

| Сервіс | Root | Start command |
|--------|------|---------------|
| api | `neuron_backend/neuron_backend` | `npx prisma migrate deploy && node index.js` |
| web | `neuron_frontend` | `npm start` (після `npm run build`) |
| analytics-worker | `neuron_backend/neuron_backend` | `npm run worker:analytics` |
| digest-worker | `neuron_backend/neuron_backend` | `npm run worker:digest` |

Деталі — `docs/COOLIFY.md`.

## 3. Обовʼязкові env (інакше прод не стартує)

На сервісі **api** (і ті ж БД-URL на воркерах):

```env
NODE_ENV=production
DATABASE_URL=postgresql://...          # з Coolify Postgres
REDIS_URL=redis://...                  # з Coolify Redis
JWT_SECRET=<випадкові 32+ символи>     # не з прикладів
CHAT_ENCRYPTION_KEY=<випадкові 32+ символи>
API_PUBLIC_URL=https://api.твійдомен
FRONTEND_URL=https://твійдомен
RESEND_API_KEY=re_...                  # обовʼязково, бо нижче true
RESEND_FROM=Neuron <noreply@твійдомен>
REQUIRE_EMAIL_VERIFICATION=true
MEDIA_STORAGE=disabled
SITE_OWNER_USERNAME=<твій нік>
MODERATOR_USERNAMES=<твій нік>
ALLOW_USER_COMMUNITIES=true
```

> Згенерувати секрети: `openssl rand -base64 48`

На сервісі **web** ці значення треба і як **Build Arguments**, і в runtime:

```env
NEXT_PUBLIC_API_URL=https://api.твійдомен
NEXT_PUBLIC_SITE_URL=https://твійдомен
NEXT_PUBLIC_LEGAL_OPERATOR=<назва оператора>
NEXT_PUBLIC_LEGAL_CONTACT=<email для юридичних питань>
```

## 4. Домен + Resend

- У Coolify привʼяжи домени: `твійдомен` → web, `api.твійдомен` → api (HTTPS видасть Caddy автоматично).
- У Resend верифікуй домен (DNS-записи), щоб приходили листи підтвердження.

## 5. Перший деплой + перевірка

Перший раз задеплой вручну в Coolify, далі:

```bash
npm run verify:deploy -- https://api.твійдомен
```

Очікувано `GET /api/health` → `postgres: connected`, `redis: connected`,
`media: disabled`, `email: verification_required`. Ручні перевірки — у `docs/COOLIFY.md`.

## 6. Увімкнути автодеплой (push → prod)

У **GitHub → Settings → Secrets and variables → Actions** додай секрети:

| Секрет | Що це | Звідки |
|--------|-------|--------|
| `COOLIFY_WEBHOOK` | URL deploy-хука | Coolify → застосунок → Webhooks |
| `COOLIFY_TOKEN` | Bearer-токен API (якщо хук його вимагає) | Coolify → Keys & Tokens |
| `DEPLOY_API_URL` | `https://api.твійдомен` | твій домен |

(Опційно `vars.DEPLOY_WAIT_SECONDS` — скільки чекати перед health-check, типово 60.)

Після цього будь-який `push` у `main` сам прокотить тести → деплой → перевірку.
Тег `vX.Y.Z` робить те саме (релізи). Ручний запуск — кнопка **Run workflow**.

---

## Що вже зроблено в коді (цей сеанс)

- `.github/workflows/deploy.yml` тепер деплоїть автоматично на push у `main`
  (раніше — лише на теги/вручну, і крок деплою був заглушкою).
- Реальний виклик Coolify webhook + health-check з ретраями замість плейсхолдера.
- Перевірено: 170 JS-файлів бекенду синтаксично валідні; build/start-скрипти фронта на місці.

## Чого я зробити не можу (потрібен ти)

- Орендувати/налаштувати сервер і Coolify — немає доступу до твого хостингу.
- Прописати GitHub-секрети й купити домен — це робиться у твоїх акаунтах.
- Прогнати повний `next build` тут не вдалось (обмеження пісочниці) — він виконається у CI на кроці `verify`.

## Опційно після старту

- Web Push: `npm run ops:vapid` → додати `VAPID_*`.
- Бекапи Postgres: `npm run ops:backup-cron` на VPS.
- Sentry-алерти: `docs/ops/SENTRY-ALERTS.md`.
- Медіа (картинки/файли): `docs/ops/ENABLE-MEDIA.md`.
