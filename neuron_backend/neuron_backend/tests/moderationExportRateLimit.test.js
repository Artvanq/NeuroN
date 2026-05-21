const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMemoryRedis } = require('./helpers/memoryRedis');
const { request } = require('./helpers/httpRequest');

test('moderationExportRateLimit returns 429 after max requests', async () => {
  const redisPath = require.resolve('../utils/redis');
  const rateLimitPath = require.resolve('../middleware/rateLimit');
  const originalRedis = require.cache[redisPath];
  const originalRateLimit = require.cache[rateLimitPath];

  const memoryRedis = createMemoryRedis();
  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
      isRedisAvailable: () => true,
      getRedis: () => memoryRedis,
    },
  };

  delete require.cache[rateLimitPath];
  const { rateLimit } = require('../middleware/rateLimit');
  const limiter = rateLimit({
    windowSec: 60,
    max: 2,
    keyPrefix: 'mod-export-test',
    keyBuilder: ({ req, keyPrefix }) => `${keyPrefix}:${req.user?._id || 'anon'}`,
  });

  const app = express();
  app.use((req, _res, next) => {
    req.user = { _id: req.headers['x-test-user-id'] || 'anon' };
    next();
  });
  app.get('/export', limiter, (req, res) => {
    res.json({ ok: true, userId: req.user?._id || null });
  });

  const headers = { 'x-test-user-id': 'user-1' };

  const first = await request(app, { path: '/export', headers });
  const second = await request(app, { path: '/export', headers });
  const third = await request(app, { path: '/export', headers });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  assert.match(third.json().message, /Too many requests/);

  if (originalRedis) require.cache[redisPath] = originalRedis;
  else delete require.cache[redisPath];
  if (originalRateLimit) require.cache[rateLimitPath] = originalRateLimit;
  else delete require.cache[rateLimitPath];
});
