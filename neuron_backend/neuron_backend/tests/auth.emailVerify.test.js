const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('./helpers/httpRequest');
const { createAuthApp, clearModuleCache } = require('./helpers/authRouteHarness');

test.after(() => {
  clearModuleCache();
});

test('POST /api/auth/email/verify/request-public requires identity', async () => {
  const app = createAuthApp({
    prismaMock: {
      user: { findUnique: async () => null },
    },
  });
  const res = await request(app, {
    method: 'POST',
    path: '/api/auth/email/verify/request-public',
    body: {},
  });
  assert.equal(res.status, 400);
});

test('POST /api/auth/email/verify/request-public sends email for unverified user', async () => {
  const created = [];
  const emails = [];
  const prismaMock = {
    user: {
      findUnique: async ({ where }) => {
        if (where?.username === 'alice') {
          return {
            id: 'user-1',
            email: 'alice@example.com',
            emailVerifiedAt: null,
          };
        }
        return null;
      },
    },
    emailVerificationToken: {
      create: async ({ data }) => {
        created.push(data);
        return { id: 'tok-1', ...data };
      },
    },
  };
  const app = createAuthApp({
    prismaMock,
    sendEmail: async (payload) => {
      emails.push(payload);
    },
  });
  const res = await request(app, {
    method: 'POST',
    path: '/api/auth/email/verify/request-public',
    body: { identity: 'alice' },
  });
  assert.equal(res.status, 200);
  assert.equal(created.length, 1);
  assert.equal(created[0].email, 'alice@example.com');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'alice@example.com');
});

test('POST /api/auth/email/verify/request-public is silent for verified users', async () => {
  const created = [];
  const prismaMock = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'alice@example.com',
        emailVerifiedAt: new Date(),
      }),
    },
    emailVerificationToken: {
      create: async (args) => {
        created.push(args);
        return {};
      },
    },
  };
  const app = createAuthApp({ prismaMock });
  const res = await request(app, {
    method: 'POST',
    path: '/api/auth/email/verify/request-public',
    body: { identity: 'alice@example.com' },
  });
  assert.equal(res.status, 200);
  assert.equal(created.length, 0);
});
