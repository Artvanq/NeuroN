/**
 * Optional Sentry reporting for API and workers.
 * Set SENTRY_DSN to enable; disabled when unset.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'apikey',
  'captcharesponse',
]);

let initialized = false;
let Sentry = null;

function parseSampleRate(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function scrubValue(key, value) {
  if (value == null) return value;
  const k = String(key || '').toLowerCase();
  if (SENSITIVE_KEYS.has(k)) return '[Filtered]';
  if (typeof value === 'object') return scrubObject(value);
  return value;
}

function scrubObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' ? scrubObject(item, depth + 1) : item));
  }
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = scrubValue(key, value);
  }
  return out;
}

function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return event;

  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubObject(event.request.headers);
    }
    if (event.request.cookies) {
      event.request.cookies = scrubObject(event.request.cookies);
    }
    if (event.request.data) {
      event.request.data = scrubObject(event.request.data);
    }
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== 'object') return crumb;
      const next = { ...crumb };
      if (next.data) next.data = scrubObject(next.data);
      return next;
    });
  }

  return event;
}

function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function loadSentry() {
  if (Sentry) return Sentry;
  // eslint-disable-next-line global-require
  Sentry = require('@sentry/node');
  return Sentry;
}

function initSentry(options = {}) {
  if (initialized) return true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;

  const sdk = loadSentry();
  const isProd = process.env.NODE_ENV === 'production';
  const defaultSample = isProd ? 0.1 : 0;

  sdk.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    serverName: options.serverName || 'neuron-api',
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, defaultSample),
    beforeSend: scrubSentryEvent,
  });

  initialized = true;
  return true;
}

function captureException(err, context) {
  if (!initialized || !err) return;
  const sdk = loadSentry();
  sdk.withScope((scope) => {
    if (context && typeof context === 'object') {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    sdk.captureException(err);
  });
}

function captureMessage(message, level = 'info') {
  if (!initialized || !message) return;
  loadSentry().captureMessage(message, level);
}

module.exports = {
  isSentryEnabled,
  scrubSentryEvent,
  initSentry,
  captureException,
  captureMessage,
};
