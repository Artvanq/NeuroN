const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./jwtSecret');
const { isRedisConfigured, isRedisAvailable, getRedis } = require('./redis');

const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_SEC || 30 * 24 * 60 * 60);
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';

function userSessionSetKey(userId) {
  return `refresh:user:${userId}`;
}

function parseStoredSession(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.userId && data?.jti) return data;
  } catch {
    /* old format fallback */
  }
  return null;
}

function assertRedisForSessions() {
  if (isRedisAvailable()) return;

  if (process.env.NODE_ENV === 'production') {
    const err = new Error('Redis is required in production for secure sessions');
    err.status = 503;
    throw err;
  }

  if (!isRedisConfigured()) {
    const err = new Error(
      'Set REDIS_URL in .env (e.g. redis://127.0.0.1:6379) and start Redis: docker compose up -d redis'
    );
    err.status = 503;
    throw err;
  }

  const err = new Error(
    'Redis is configured but not reachable. Run: docker compose up -d redis'
  );
  err.status = 503;
  throw err;
}

function signAccessToken(userId) {
  return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(userId) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ userId, type: 'refresh', jti }, JWT_SECRET, {
    expiresIn: REFRESH_TTL_SEC,
  });
  return { token, jti, userId };
}

async function storeRefreshSession(jti, userId, metadata = {}) {
  const redis = getRedis();
  const payload = {
    jti,
    userId,
    createdAt: new Date().toISOString(),
    ip: metadata.ip || null,
    userAgent: metadata.userAgent || null,
  };
  await redis.set(`refresh:${jti}`, JSON.stringify(payload), 'EX', REFRESH_TTL_SEC);
  await redis.sadd(userSessionSetKey(userId), jti);
}

async function revokeRefreshSession(jti, expectedUserId = null) {
  const redis = getRedis();
  const raw = await redis.get(`refresh:${jti}`);
  const parsed = parseStoredSession(raw);
  const userId = expectedUserId || parsed?.userId || (raw && !parsed ? raw : null);
  await redis.del(`refresh:${jti}`);
  if (userId) {
    await redis.srem(userSessionSetKey(userId), jti);
  }
}

async function validateRefreshToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (payload.type !== 'refresh' || !payload.jti || !payload.userId) {
    return null;
  }

  const redis = getRedis();
  if (!redis) return null;

  const stored = await redis.get(`refresh:${payload.jti}`);
  if (!stored) {
    return null;
  }

  const parsed = parseStoredSession(stored);
  if (parsed) {
    if (parsed.userId !== payload.userId) return null;
    return { userId: payload.userId, jti: payload.jti, createdAt: parsed.createdAt };
  }
  if (stored !== payload.userId) return null;
  return { userId: payload.userId, jti: payload.jti };
}

async function issueTokenPair(userId, metadata = {}) {
  assertRedisForSessions();
  const accessToken = signAccessToken(userId);
  const { token: refreshToken, jti } = signRefreshToken(userId);
  await storeRefreshSession(jti, userId, metadata);
  return { accessToken, refreshToken };
}

async function listUserSessions(userId) {
  const redis = getRedis();
  const jtis = await redis.smembers(userSessionSetKey(userId));
  if (!jtis.length) return [];

  const pipeline = redis.pipeline();
  jtis.forEach((jti) => pipeline.get(`refresh:${jti}`));
  const values = await pipeline.exec();

  const sessions = [];
  for (let i = 0; i < jtis.length; i += 1) {
    const jti = jtis[i];
    const raw = values?.[i]?.[1];
    const parsed = parseStoredSession(raw);
    if (!raw) {
      // stale index cleanup
      // eslint-disable-next-line no-await-in-loop
      await redis.srem(userSessionSetKey(userId), jti);
      continue;
    }
    sessions.push({
      jti,
      createdAt: parsed?.createdAt || null,
      ip: parsed?.ip || null,
      userAgent: parsed?.userAgent || null,
    });
  }
  return sessions.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function revokeAllUserSessions(userId, exceptJti = null) {
  const redis = getRedis();
  const jtis = await redis.smembers(userSessionSetKey(userId));
  for (const jti of jtis) {
    if (exceptJti && jti === exceptJti) continue;
    // eslint-disable-next-line no-await-in-loop
    await revokeRefreshSession(jti, userId);
  }
}

function setRefreshCookie(res, refreshToken) {
  if (!refreshToken) return;
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: REFRESH_TTL_SEC * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

module.exports = {
  ACCESS_EXPIRES,
  signAccessToken,
  issueTokenPair,
  validateRefreshToken,
  revokeRefreshSession,
  listUserSessions,
  revokeAllUserSessions,
  setRefreshCookie,
  clearRefreshCookie,
  assertRedisForSessions,
};
