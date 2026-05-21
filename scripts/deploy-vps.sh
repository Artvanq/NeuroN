#!/usr/bin/env sh
# One-command deploy on a fresh VPS (Docker required).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Copy .env.budget.example to .env and edit secrets/domains first." >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
echo "Health:"
curl -sf "${API_PUBLIC_URL:-http://127.0.0.1:4000}/api/health" || curl -sf http://127.0.0.1:4000/api/health || true
echo ""
echo "Done. Web: ${FRONTEND_URL:-http://127.0.0.1:3000}"
