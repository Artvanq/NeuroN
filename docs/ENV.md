# Environment variables

Neuron uses **one** env file at the repository root:

| File | Purpose |
|------|---------|
| `.env` | Your secrets (gitignored) — create from `.env.example` |
| `.env.example` | Template with all keys |

## Who reads `.env`

| Process | How |
|---------|-----|
| API | `utils/loadEnv.js` → repo root `.env` |
| Workers | same |
| Next.js dev/build | `next.config.js` → `loadEnvConfig(..)` on repo root |
| `docker-compose.prod.yml` | `env_file: .env` |

## Local dev quick start

```bash
cp .env.example .env
# Edit JWT_SECRET, CHAT_ENCRYPTION_KEY, MODERATOR_USERNAMES, SITE_OWNER_USERNAME

docker compose up -d postgres redis   # if using Docker DB
cd neuron_backend/neuron_backend && npm run dev
cd neuron_frontend && npm run dev     # http://localhost:3001
```

Important:

- `NEXT_PUBLIC_API_URL` must point to API (`http://localhost:4000`), not the Next port.
- `FRONTEND_URL` must match the browser origin (`http://localhost:3001`).

## Coolify / production

Paste the same keys from `.env.example` into Coolify env for **api**, **web** (build args + runtime for `NEXT_PUBLIC_*`), **analytics-worker**, **digest-worker**.

Do not keep duplicate `.env` files under `neuron_backend/` or `neuron_frontend/` unless you need a temporary local override.
