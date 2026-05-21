const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('./helpers/httpRequest');
const { createMemoryRedis } = require('./helpers/memoryRedis');
const {
  createReportsApp,
  defaultPrismaMock,
  authHeader,
  clearModuleCache,
} = require('./helpers/reportsRouteHarness');

const modUser = { _id: 'mod-1', username: 'moduser', isBanned: false };
const regularUser = { _id: 'user-1', username: 'alice', isBanned: false };

test.after(() => {
  clearModuleCache();
});

test('GET /api/reports requires authentication', async () => {
  const app = createReportsApp();
  const res = await request(app, { path: '/api/reports' });
  assert.equal(res.status, 401);
});

test('POST /api/reports rejects unknown thread target', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    method: 'POST',
    path: '/api/reports',
    headers: authHeader(regularUser),
    body: { targetType: 'thread', targetId: 'missing-thread', reason: 'This is abusive content' },
  });
  assert.equal(res.status, 404);
  assert.match(res.json().message, /Target not found/);
});

test('POST /api/reports rejects unknown project path target', async () => {
  const prismaMock = defaultPrismaMock({
    user: {
      findUnique: async ({ where }) => {
        if (where?.username === 'alice') return { id: 'owner-1', username: 'alice' };
        return null;
      },
      update: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
    project: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
  });
  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    method: 'POST',
    path: '/api/reports',
    headers: authHeader(regularUser),
    body: { targetType: 'project', targetId: 'alice/missing', reason: 'Project violates policy' },
  });
  assert.equal(res.status, 404);
  assert.match(res.json().message, /Target not found/);
});

test('GET /api/reports allows users with platformRole MODERATOR', async () => {
  const prismaMock = defaultPrismaMock();
  const app = createReportsApp({
    prismaMock,
    moderatorUsernames: '',
  });
  const roleMod = { _id: 'mod-2', username: 'rolemod', platformRole: 'MODERATOR', isBanned: false };
  const res = await request(app, {
    path: '/api/reports',
    headers: authHeader(roleMod),
  });
  assert.equal(res.status, 200);
});

test('GET /api/reports rejects non-moderators', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    path: '/api/reports',
    headers: authHeader(regularUser),
  });
  assert.equal(res.status, 403);
  assert.match(res.json().message, /Moderator access required/);
});

test('GET /api/reports returns queue for moderators', async () => {
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 1,
      findMany: async () => [
        {
          id: 'rep-1',
          targetType: 'thread',
          targetId: 'thread-1',
          reason: 'spam content here',
          status: 'open',
          createdAt: new Date('2026-05-19T10:00:00.000Z'),
          reporter: {
            id: 'user-2',
            username: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
          },
        },
      ],
      findUnique: async () => null,
      findFirst: async () => null,
    },
    thread: {
      findUnique: async () => ({ title: 'Test thread' }),
      update: async () => ({}),
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    path: '/api/reports?status=open',
    headers: authHeader(modUser),
  });

  assert.equal(res.status, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]._id, 'rep-1');
  assert.equal(body.items[0].targetHref, '/t/thread-1');
});

test('GET /api/reports enriches reply targets with thread hash links', async () => {
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 1,
      findMany: async () => [
        {
          id: 'rep-reply',
          targetType: 'reply',
          targetId: 'reply-9',
          reason: 'off-topic branch',
          status: 'open',
          createdAt: new Date('2026-05-19T11:00:00.000Z'),
          reporter: {
            id: 'user-2',
            username: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
          },
        },
      ],
      findUnique: async () => null,
      findFirst: async () => null,
    },
    reply: {
      findUnique: async () => ({ threadId: 'thread-42' }),
      update: async () => ({}),
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    path: '/api/reports',
    headers: authHeader(modUser),
  });

  assert.equal(res.status, 200);
  const body = res.json();
  assert.equal(body.items[0].targetHref, '/t/thread-42#reply-reply-9');
});

test('GET /api/reports/export rejects non-moderators', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    path: '/api/reports/export',
    headers: authHeader(regularUser),
  });
  assert.equal(res.status, 403);
});

test('GET /api/reports/export returns bundled payload for moderators', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    path: '/api/reports/export?reportLimit=10&auditLimit=10',
    headers: authHeader(modUser),
  });

  assert.equal(res.status, 200);
  const body = res.json();
  assert.ok(body.exportedAt);
  assert.equal(Array.isArray(body.reports), true);
  assert.equal(Array.isArray(body.audit), true);
  assert.equal(body.limits.reports, 10);
  assert.equal(body.limits.audit, 10);
});

test('GET /api/reports/export is rate limited per moderator', async () => {
  const originalMax = process.env.MOD_EXPORT_RATE_MAX;
  const originalWindow = process.env.MOD_EXPORT_RATE_WINDOW_SEC;
  process.env.MOD_EXPORT_RATE_MAX = '2';
  process.env.MOD_EXPORT_RATE_WINDOW_SEC = '60';

  const memoryRedis = createMemoryRedis();
  const app = createReportsApp({ redisClient: memoryRedis });

  const headers = authHeader(modUser);
  const first = await request(app, { path: '/api/reports/export', headers });
  const second = await request(app, { path: '/api/reports/export', headers });
  const third = await request(app, { path: '/api/reports/export', headers });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);

  if (originalMax === undefined) delete process.env.MOD_EXPORT_RATE_MAX;
  else process.env.MOD_EXPORT_RATE_MAX = originalMax;
  if (originalWindow === undefined) delete process.env.MOD_EXPORT_RATE_WINDOW_SEC;
  else process.env.MOD_EXPORT_RATE_WINDOW_SEC = originalWindow;
});

test('GET /api/reports/export.csv returns csv attachment', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    path: '/api/reports/export.csv',
    headers: authHeader(modUser),
  });

  assert.equal(res.status, 200);
  assert.match(String(res.headers['content-type']), /text\/csv/);
  assert.match(String(res.headers['content-disposition']), /attachment/);
  assert.match(res.text, /^"kind"/);
});

test('PATCH /api/reports/:id validates status', async () => {
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => ({
        id: 'rep-1',
        reporterId: 'user-2',
        targetType: 'thread',
        targetId: 'thread-1',
        status: 'open',
      }),
      findFirst: async () => null,
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/reports/rep-1',
    headers: authHeader(modUser),
    body: { status: 'invalid-status', action: 'none' },
  });

  assert.equal(res.status, 400);
  assert.match(res.json().message, /Invalid status/);
});

test('PATCH /api/reports/:id rejects non-moderators', async () => {
  const app = createReportsApp();
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/reports/rep-1',
    headers: authHeader(regularUser),
    body: { status: 'reviewed', action: 'none' },
  });
  assert.equal(res.status, 403);
});

test('PATCH /api/reports/:id updates report and writes audit log', async () => {
  let auditCreated = false;
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => ({
        id: 'rep-1',
        reporterId: 'user-2',
        targetType: 'thread',
        targetId: 'thread-1',
        status: 'open',
      }),
      findFirst: async () => null,
      update: async ({ data }) => ({
        id: 'rep-1',
        reporterId: 'user-2',
        targetType: 'thread',
        targetId: 'thread-1',
        reason: 'spam',
        status: data.status,
        createdAt: new Date(),
      }),
    },
    moderationAction: {
      count: async () => 0,
      findMany: async () => [],
      create: async ({ data }) => {
        auditCreated = true;
        assert.equal(data.action, 'none');
        assert.equal(data.moderatorId, modUser._id);
        return { id: 'audit-1', ...data };
      },
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/reports/rep-1',
    headers: authHeader(modUser),
    body: { status: 'reviewed', action: 'none', note: 'looks fine' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json().status, 'reviewed');
  assert.equal(auditCreated, true);
});

test('PATCH /api/reports/:id can ban owner for project target path format', async () => {
  const updatedUserIds = [];
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => ({
        id: 'rep-proj-1',
        reporterId: 'user-2',
        targetType: 'project',
        targetId: 'alice/demo',
        status: 'open',
      }),
      findFirst: async () => null,
      update: async ({ data }) => ({
        id: 'rep-proj-1',
        status: data.status,
        createdAt: new Date(),
      }),
    },
    user: {
      findUnique: async ({ where }) => {
        if (where?.username === 'alice') return { id: 'owner-1' };
        return null;
      },
      update: async ({ where }) => {
        updatedUserIds.push(where.id);
        return {};
      },
      updateMany: async () => ({ count: 0 }),
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/reports/rep-proj-1',
    headers: authHeader(modUser),
    body: { status: 'actioned', action: 'user_banned', note: 'abuse' },
  });

  assert.equal(res.status, 200);
  assert.equal(updatedUserIds.includes('owner-1'), true);
});

test('PATCH /api/reports/:id can unban owner for file target path format', async () => {
  const updatedUserIds = [];
  const prismaMock = defaultPrismaMock({
    report: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => ({
        id: 'rep-file-1',
        reporterId: 'user-2',
        targetType: 'file',
        targetId: 'alice/demo:src/index.js',
        status: 'open',
      }),
      findFirst: async () => null,
      update: async ({ data }) => ({
        id: 'rep-file-1',
        status: data.status,
        createdAt: new Date(),
      }),
    },
    user: {
      findUnique: async ({ where }) => {
        if (where?.username === 'alice') return { id: 'owner-1' };
        return null;
      },
      update: async ({ where }) => {
        updatedUserIds.push(where.id);
        return {};
      },
      updateMany: async () => ({ count: 0 }),
    },
  });

  const app = createReportsApp({ prismaMock });
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/reports/rep-file-1',
    headers: authHeader(modUser),
    body: { status: 'actioned', action: 'user_unbanned', note: 'false positive' },
  });

  assert.equal(res.status, 200);
  assert.equal(updatedUserIds.includes('owner-1'), true);
});
