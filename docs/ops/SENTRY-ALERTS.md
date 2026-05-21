# Sentry alerts for Neuron

## Environment

| Service | Variable |
|---------|----------|
| API | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` |
| analytics-worker | same DSN, `serverName: neuron-analytics-worker` (in code) |
| Web | `NEXT_PUBLIC_SENTRY_DSN` (+ rebuild) |

## Recommended alert rules

### 1. Error spike (production)

- **When:** event count &gt; 15 in 5 minutes  
- **Filter:** `environment:production` AND `level:error`  
- **Action:** Email + Slack (or PagerDuty on-call)

### 2. New fatal issue

- **When:** A new issue is created  
- **Filter:** `level:fatal` OR tag `worker:analytics`  
- **Action:** Email immediately

### 3. API degraded health (manual)

Use external uptime (UptimeRobot, Better Stack) on:

- `GET https://api.yourdomain.com/api/health` — expect `"status":"ok"`
- `GET https://yourdomain.com` — HTTP 200

Sentry does not replace synthetic monitoring for health endpoints.

### 4. Digest / email failures

Watch logs for `notificationEmail` / Resend errors. Optional: log-based alert in your host if Resend returns 4xx spikes.

## Test

1. Temporarily set invalid DSN on staging — confirm no crash (Sentry disabled).
2. On staging with valid DSN, trigger `throw new Error('sentry smoke')` in a test route or use Sentry “Send test event”.
3. Confirm alert fires to the right channel within 5 minutes.

## Release tracking

Set per deploy:

```env
SENTRY_RELEASE=neuron-api@2026.05.20
```

Frontend:

```env
NEXT_PUBLIC_SENTRY_RELEASE=neuron-web@2026.05.20
```

Regressions then group by release in Sentry Issues → Releases.
