# Neuron — статус по плану

Живой чеклист относительно [roadmap.md](./roadmap.md) и вашего полного списка.  
**v1 launch (Coolify, text-only):** [COOLIFY.md](./COOLIFY.md).  
**Launch blockers (ops):** [PRODUCTION-OPS.md](./PRODUCTION-OPS.md).

Легенда: **DONE** · **PARTIAL** · **NOT**

## 1. Инфраструктура и прод

| Пункт | Статус | Примечание |
|-------|--------|------------|
| Resend + email utils | DONE | `utils/email.js`, `RESEND_*` |
| Триггеры (reply, DM, request, PR/issue, digest) | DONE | `notificationEmail.js` |
| Password reset | DONE | API + UI |
| Email verify при регистрации | DONE | `REQUIRE_EMAIL_VERIFICATION` + resend public |
| ClickHouse analytics | PARTIAL | worker + `CLICKHOUSE_ENSURE_TABLE`; без URL → log |
| Workers в деплое | DONE | compose prod + Coolify docs |
| MongoDB interest_profile | NOT | JSONB в Postgres (намеренно) |
| SETUP.md ↔ код | PARTIAL | см. [SETUP.md](../SETUP.md) |
| OpenAPI | PARTIAL | `docs/openapi.yaml` ~paths, мало схем |
| Architecture / roadmap | DONE | `docs/architecture.md`, `roadmap.md` |
| Миграции prod | DONE | `prisma migrate deploy` |
| Бэкапы Postgres | PARTIAL | скрипт + `install-backup-cron.sh`; cron на VPS |
| Sentry / logs / алерты | PARTIAL | Sentry есть; гайд `docs/ops/SENTRY-ALERTS.md` |
| Feature flags | DONE | `FEATURE_FLAGS` env; health + Settings |
| GDPR delete/export | DONE | API + settings |
| Terms / Privacy / cookies | DONE | полные страницы + `NEXT_PUBLIC_LEGAL_*` |
| CSP, 2FA, sessions | DONE | revoke all в settings |
| OAuth unlink | DONE | API + UI |
| Health ↔ docs | DONE | + `services.analytics`, `webPush` |
| Load / E2E | PARTIAL | 77+ unit, load-smoke, ~11 Playwright |
| CI/CD | PARTIAL | `ci.yml` + `deploy.yml`; verify via `DEPLOY_API_URL` |

## 2. Projects (GitHub-аналог)

| Пункт | Статус |
|-------|--------|
| Git objects | NOT |
| File blame / history (Code tab) | DONE |
| Native git HTTP clone | DONE |
| Git SSH | DONE |
| Collaborators | DONE |
| Organizations | DONE |
| Fork | DONE |
| Project visibility | DONE |
| Star / watch | DONE |
| Issue templates | DONE |
| Labels + issue board | DONE |
| Milestones | DONE |
| Assignees | DONE |
| Issue comments | DONE |
| PR head branch, reviews, protection, CI gate | DONE |
| Draft PR | DONE |
| Squash/rebase merge | DONE |
| Inline PR review comments | DONE |
| Full Actions runner | PARTIAL |

## 3. Resonance

| Пункт | Статус |
|-------|--------|
| User-created communities | DONE |
| Field moderators | DONE |
| Mod queue UI | DONE |
| Lock thread | DONE |
| Pin thread | DONE |
| Crosspost / polls | DONE |
| Fields = 10 broad lenses (not uni departments) | DONE | `seedCategories.js` |
| Inquiries (cross-field question tags) | DONE | `Inquiry` + `/api/inquiries`, `/i/[slug]` |
| Rich media POST (v1) | OFF | `MEDIA_STORAGE=disabled`; enable: `docs/ops/ENABLE-MEDIA.md` |

## 4. Dialogue

| Пункт | Статус |
|-------|--------|
| Chat media (v1) | OFF | compose скрыт при disabled |
| Edit/delete/reactions/read | DONE |
| Web Push | PARTIAL | `npm run ops:vapid` + `VERIFY_EXPECT_WEB_PUSH=1` |
| Search messages | DONE |
| FTS threads | DONE |

## 5. Launch blockers — статус

| Блокер | Статус | Действие оператора |
|--------|--------|-------------------|
| Legal | DONE (в коде) | Задать `NEXT_PUBLIC_LEGAL_*`, review с юристом |
| ClickHouse | OPTIONAL | `CLICKHOUSE_URL` + worker; иначе `log_only` OK |
| Бэкапы cron | READY | `npm run ops:backup-cron` на VPS |
| R2 lifecycle | READY | `scripts/r2-lifecycle-rules.example.json` при media |
| Sentry alerts | READY | `docs/ops/SENTRY-ALERTS.md` |
| VAPID prod | READY | `npm run ops:vapid` |
| Coolify verify | READY | `npm run verify:deploy` |
| Media R2+scan | READY | `docs/ops/ENABLE-MEDIA.md` когда нужно |

## 6. Следующие приоритеты

1. **Coolify prod** — deploy + `npm run verify:deploy`
2. **VPS cron** — `ops:backup-cron` + Sentry alert rules
3. **Web Push** — VAPID on prod (опционально для v1 text-only)

Обновляйте этот файл при закрытии эпиков.
