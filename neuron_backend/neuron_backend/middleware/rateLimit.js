const { getRedis, isRedisAvailable } = require('../utils/redis');

/**
 * Fixed-window rate limit (2 Redis commands per check — Upstash-friendly).
 */
function rateLimit({ windowSec = 60, max = 30, keyPrefix = 'rl', keyBuilder = null }) {
  return async (req, res, next) => {
    if (!isRedisAvailable()) {
      return next();
    }

    const redis = getRedis();
    if (!redis) return next();

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const route = req.baseUrl + req.path;
    const key = keyBuilder
      ? String(keyBuilder({ req, ip, route, keyPrefix }))
      : `${keyPrefix}:${ip}:${route}`;

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
      console.warn('Rate limit skip:', err.message);
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
