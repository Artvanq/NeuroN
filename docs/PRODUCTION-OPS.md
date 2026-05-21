# Production operations — launch blockers

Runbook for items that block a mature public launch. Pair with [COOLIFY.md](./COOLIFY.md) and [LAUNCH.md](./LAUNCH.md).

## Quick checklist

| Item | Doc section | Verify |
|------|-------------|--------|
| Legal pages | §1 | `/terms`, `/privacy` + env operator/contact |
| ClickHouse (optional) | §2 | `services.analytics: clickhouse` in health |
| Postgres backups | §3 | cron + `backups/*.sql.gz` |
| R2 lifecycle | §4 | Cloudflare rules when media on |
| Sentry alerts | §5 | test alert in Sentry |
| Web Push VAPID | §6 | `services.webPush: configured` |
| Post-deploy smoke | §7 | `npm run verify:deploy` |
| Media R2 + scan | §8 | `MEDIA_STORAGE=r2` + scan URL |

---

## 1. Legal (Terms & Privacy)

Pages: `/terms`, `/privacy` — full policy text (not a one-paragraph stub).

**Coolify / frontend build + runtime:**

```env
NEXT_PUBLIC_LEGAL_OPERATOR=Your Org Name
NEXT_PUBLIC_LEGAL_CONTACT=legal@yourdomain.com
```

If unset, contact defaults to `legal@<your-domain>` from `NEXT_PUBLIC_SITE_URL`.

Have counsel review before high-traffic launch.

---

## 2. ClickHouse analytics (optional)

Without `CLICKHOUSE_URL`, the analytics worker logs events only (`services.analytics: log_only`).

**Enable:**

1. Run ClickHouse (managed or self-hosted).
2. On **analytics-worker** (first deploy only):

```env
CLICKHOUSE_URL=https://user:pass@clickhouse.host:8443/default
CLICKHOUSE_TABLE=analytics_events
CLICKHOUSE_ENSURE_TABLE=true
```

3. After first successful start, set `CLICKHOUSE_ENSURE_TABLE=false` (or remove).
4. Restart worker. Health on API: `GET /api/health` → `"analytics": "clickhouse"`.

DDL reference: [ops/clickhouse-schema.sql](./ops/clickhouse-schema.sql).

---

## 3. Postgres backups (cron)

Script: `scripts/backup-postgres.sh`

**Install daily cron on VPS** (runs against host or postgres container):

```bash
chmod +x scripts/backup-postgres.sh scripts/install-backup-cron.sh
export DATABASE_URL='postgresql://neuron:PASSWORD@127.0.0.1:5432/neuron'
export BACKUP_DIR=/var/backups/neuron
export BACKUP_RETENTION_DAYS=14
./scripts/install-backup-cron.sh
```

Or manual:

```bash
0 3 * * * cd /opt/neuron && DATABASE_URL='...' BACKUP_DIR=/var/backups/neuron ./scripts/backup-postgres.sh >> /var/log/neuron-backup.log 2>&1
```

**Restore test** (quarterly): restore `.sql.gz` to a staging DB and run `verify-deploy`.

---

## 4. R2 lifecycle (when media enabled)

Example rules: `scripts/r2-lifecycle-rules.example.json`

In Cloudflare R2 → bucket → **Lifecycle rules**:

- Delete incomplete multipart uploads after 7 days.
- Expire objects under prefix `tmp/` after 1 day (if you use temp uploads).
- Optional: transition old `uploads/` to Infrequent Access after 90 days.

See [ops/ENABLE-MEDIA.md](./ops/ENABLE-MEDIA.md).

---

## 5. Sentry alerts

1. Create project → set `SENTRY_DSN` (API) and `NEXT_PUBLIC_SENTRY_DSN` (web, rebuild).
2. In Sentry: **Alerts → Create** — recommended:
   - Issue count &gt; 10 in 5m (production, `level:error`)
   - New issue on `neuron-api` or `neuron-analytics-worker`
   - Spike in `transaction` duration p95 (if tracing enabled)
3. Route to email/Slack/PagerDuty.
4. Set `SENTRY_ENVIRONMENT=production`, `SENTRY_RELEASE` per deploy tag.

Details: [ops/SENTRY-ALERTS.md](./ops/SENTRY-ALERTS.md).

---

## 6. Web Push (VAPID)

Generate keys (on a secure machine):

```bash
cd neuron_backend/neuron_backend && npx web-push generate-vapid-keys
# Or: npm run ops:vapid
```

On **api** service:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ops@yourdomain.com
```

Restart API. Health: `"webPush": "configured"`. Users enable in Settings.

Strict verify (optional):

```bash
VERIFY_EXPECT_WEB_PUSH=1 ./scripts/verify-deploy.sh https://api.yourdomain.com
```

---

## 7. Coolify prod — migrate + verify

**API start command** (required):

```bash
npx prisma migrate deploy && node index.js
```

**After each deploy:**

```bash
npm run verify:deploy -- https://api.yourdomain.com
```

Optional env for stricter checks:

| Env | Effect |
|-----|--------|
| `VERIFY_EXPECT_MEDIA=disabled` | default text v1 |
| `VERIFY_EXPECT_MEDIA=r2` | media must be r2 + enabled |
| `VERIFY_EXPECT_WEB_PUSH=1` | require VAPID |
| `VERIFY_EXPECT_ANALYTICS=clickhouse` | require ClickHouse |

GitHub Actions: set repo secret `DEPLOY_API_URL` — deploy workflow runs verify after tag push.

---

## 8. Enable media (R2 + scan)

When you need attachments in threads and chat: [ops/ENABLE-MEDIA.md](./ops/ENABLE-MEDIA.md).

Summary:

```env
MEDIA_STORAGE=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=neuron-media
R2_PUBLIC_URL=https://media.yourdomain.com
MEDIA_SCAN_URL=https://your-scanner/scan
MEDIA_SCAN_TOKEN=...
```

Rebuild is not required for API-only change; restart API. Re-run verify with `VERIFY_EXPECT_MEDIA=r2`.
