import * as Sentry from '@sentry/react';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'accesstoken',
  'refreshtoken',
]);

function parseSampleRate(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function scrubObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' ? scrubObject(item, depth + 1) : item));
  }
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = key.toLowerCase();
    if (SENSITIVE_KEYS.has(k)) {
      out[key] = '[Filtered]';
    } else if (typeof value === 'object') {
      out[key] = scrubObject(value, depth + 1);
    } else {
      out[key] = value;
    }
  }
  return out;
}

let initialized = false;

export function initSentryClient() {
  if (initialized || typeof window === 'undefined') return false;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return false;

  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      isProd ? 0.1 : 0
    ),
    beforeSend(event) {
      if (event?.request?.headers) {
        event.request.headers = scrubObject(event.request.headers);
      }
      if (event?.request?.data) {
        event.request.data = scrubObject(event.request.data);
      }
      return event;
    },
  });

  initialized = true;
  return true;
}

export function captureClientException(err, context) {
  if (!initialized || !err) return;
  Sentry.withScope((scope) => {
    if (context && typeof context === 'object') {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(err);
  });
}
