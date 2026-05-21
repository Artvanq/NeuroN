const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('./helpers/httpRequest');
const { createPushApp, authHeader, clearModuleCache } = require('./helpers/pushRouteHarness');

const user = { _id: 'user-1', username: 'alice', isBanned: false };

test.after(() => {
  clearModuleCache();
});

test('GET /api/push/config exposes public key when configured', async () => {
  const app = createPushApp({
    prismaMock: { pushSubscription: { findMany: async () => [] } },
    user,
  });
  const res = await request(app, { path: '/api/push/config' });
  assert.equal(res.status, 200);
  assert.equal(res.json().enabled, true);
  assert.equal(res.json().publicKey, 'test-public-key');
});

test('POST /api/push/subscribe upserts subscription', async () => {
  const upserts = [];
  const prismaMock = {
    pushSubscription: {
      upsert: async (args) => {
        upserts.push(args);
        return {
          id: 'sub-1',
          endpoint: args.where.endpoint,
          createdAt: new Date(),
        };
      },
      findMany: async () => [],
    },
  };
  const app = createPushApp({ prismaMock, user });
  const res = await request(app, {
    method: 'POST',
    path: '/api/push/subscribe',
    headers: authHeader(user),
    body: {
      endpoint: 'https://push.example/sub/1',
      keys: { p256dh: 'key1', auth: 'auth1' },
    },
  });
  assert.equal(res.status, 201);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].create.userId, 'user-1');
});

test('POST /api/push/subscribe returns 503 when push disabled', async () => {
  const app = createPushApp({
    prismaMock: { pushSubscription: { upsert: async () => ({}) } },
    user,
    webPushConfigured: false,
  });
  const res = await request(app, {
    method: 'POST',
    path: '/api/push/subscribe',
    headers: authHeader(user),
    body: {
      endpoint: 'https://push.example/sub/1',
      keys: { p256dh: 'k', auth: 'a' },
    },
  });
  assert.equal(res.status, 503);
});
