const { getRedis, isRedisAvailable } = require('../utils/redis');

// In-process fallback store used only when Redis is unavailable, so brute-force
// protection on auth endpoints doesn't silently disappear if Redis goes down.
// Not distributed across instances, but far better than no limiting at all.
const memoryStore = new Map();
function memoryCheck(key, windowSec, max) {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const entry = memoryStore.get(key);
  if (!entry || now - entry.start >= windowMs) {
    memoryStore.set(key, { start: now, count: 1 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}
// Periodically prevent unbounded growth of the fallback map.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now - entry.start > 60 * 60 * 1000) memoryStore.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

/**
 * Fixed-window rate limit (2 Redis commands per check — Upstash-friendly).
 * Falls back to an in-memory limiter (fail closed, not fail open) if Redis
 * is unavailable.
 */
function rateLimit({ windowSec = 60, max = 30, keyPrefix = 'rl', keyBuilder = null }) {
  return async (req, res, next) => {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const route = req.baseUrl + req.path;
    const key = keyBuilder
      ? String(keyBuilder({ req, ip, route, keyPrefix }))
      : `${keyPrefix}:${ip}:${route}`;

    if (!isRedisAvailable() || !getRedis()) {
      const count = memoryCheck(key, windowSec, max);
      if (count > max) {
        return res.status(429).json({
          message: 'Too many requests — try again later',
          retryAfterSec: windowSec,
        });
      }
      return next();
    }

    const redis = getRedis();

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      if (count > max) {
        return res.status(429).json({
          message: 'Too many requests — try again later',
          retryAfterSec: windowSec,
        });
      }
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      return next();
    } catch (err) {
      console.warn('Rate limit falling back to in-memory limiter:', err.message);
      const count = memoryCheck(key, windowSec, max);
      if (count > max) {
        return res.status(429).json({
          message: 'Too many requests — try again later',
          retryAfterSec: windowSec,
        });
      }
      return next();
    }
  };
}

const authRateLimit = rateLimit({ windowSec: 60, max: 20, keyPrefix: 'auth' });
const apiRateLimit = rateLimit({ windowSec: 60, max: 120, keyPrefix: 'api' });
const threadCreateRateLimit = rateLimit({
  windowSec: 5 * 60,
  max: 8,
  keyPrefix: 'threads-create',
  keyBuilder: ({ req, ip, route, keyPrefix }) =>
    `${keyPrefix}:${req.user?._id || ip}:${route}`,
});
const replyCreateRateLimit = rateLimit({
  windowSec: 60,
  max: 15,
  keyPrefix: 'replies-create',
  keyBuilder: ({ req, ip, route, keyPrefix }) =>
    `${keyPrefix}:${req.user?._id || ip}:${route}`,
});
const moderationExportRateLimit = rateLimit({
  windowSec: Number(process.env.MOD_EXPORT_RATE_WINDOW_SEC || 15 * 60),
  max: Number(process.env.MOD_EXPORT_RATE_MAX || 6),
  keyPrefix: 'mod-export',
  keyBuilder: ({ req, ip, route, keyPrefix }) =>
    `${keyPrefix}:${req.user?._id || ip}:${route}`,
});

module.exports = {
  rateLimit,
  authRateLimit,
  apiRateLimit,
  threadCreateRateLimit,
  replyCreateRateLimit,
  moderationExportRateLimit,
};
