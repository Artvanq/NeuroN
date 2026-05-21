const Redis = require('ioredis');

let client = null;
let pubClient = null;
let subClient = null;
let redisReady = false;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);
}

function redisUrl() {
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
}

function isRedisAvailable() {
  return redisReady;
}

function getRedis() {
  return redisReady ? client : null;
}

function getRedisPubSub() {
  if (!redisReady || !pubClient || !subClient) {
    return { pub: null, sub: null };
  }
  return { pub: pubClient, sub: subClient };
}

async function connectRedis() {
  if (!isRedisConfigured()) {
    redisReady = false;
    return false;
  }

  const url = redisUrl();

  try {
    if (client) {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (pubClient) {
      try {
        pubClient.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (subClient) {
      try {
        subClient.disconnect();
      } catch {
        /* ignore */
      }
    }

    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    await client.connect();
    await client.ping();

    pubClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    subClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await Promise.all([pubClient.connect(), subClient.connect()]);

    redisReady = true;
    console.log('Redis connected');
    return true;
  } catch (err) {
    redisReady = false;
    client = null;
    pubClient = null;
    subClient = null;
    console.warn(`Redis connect failed (${url.replace(/:[^:@]+@/, ':***@')}): ${err.message}`);
    console.warn('  → Start local Redis: docker compose up -d redis');
    console.warn('  → Or set REDIS_URL to your Upstash rediss:// URL');
    return false;
  }
}

async function pingRedis() {
  if (!redisReady || !client) return false;
  try {
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    redisReady = false;
    return false;
  }
}

module.exports = {
  isRedisConfigured,
  isRedisAvailable,
  getRedis,
  getRedisPubSub,
  connectRedis,
  pingRedis,
};
