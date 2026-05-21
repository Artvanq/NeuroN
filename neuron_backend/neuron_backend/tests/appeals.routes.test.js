const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const { request } = require('./helpers/httpRequest');
const { authHeader } = require('./helpers/reportsRouteHarness');

const ROOT = path.join(__dirname, '..');

function clearAppealsModules() {
  ['./routes/appeals', './middleware/auth', './utils/prisma', './utils/rbac'].forEach((rel) => {
    try {
      const resolved = require.resolve(rel, { paths: [ROOT] });
      delete require.cache[resolved];
    } catch {
      /* ignore */
    }
  });
}

function createAppealsApp(prismaMock, { moderatorUsernames = 'moduser' } = {}) {
  process.env.MODERATOR_USERNAMES = moderatorUsernames;
  clearAppealsModules();

  const authPath = require.resolve('./middleware/auth', { paths: [ROOT] });
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      requireAuthIncludingBanned(req, res, next) {
        const raw = req.headers['x-test-user'];
        if (!raw) return res.status(401).json({ message: 'Authentication required' });
        try {
          req.user = JSON.parse(raw);
        } catch {
          return res.status(401).json({ message: 'Authentication required' });
        }
        return next();
      },
      attachUserIncludingBanned(req, _res, next) {
        const raw = req.headers['x-test-user'];
        if (raw) {
          try {
            req.user = JSON.parse(raw);
          } catch {
            req.user = null;
          }
        } else {
          req.user = null;
        }
        return next();
      },
    },
  };

  const prismaPath = require.resolve('./utils/prisma', { paths: [ROOT] });
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };

  const rateLimitPath = require.resolve('./middleware/rateLimit', { paths: [ROOT] });
  require.cache[rateLimitPath] = {
    id: rateLimitPath,
    filename: rateLimitPath,
    loaded: true,
    exports: {
      authRateLimit: (_req, _res, next) => next(),
    },
  };

  const authHelpersPath = require.resolve('./utils/authHelpers', { paths: [ROOT] });
  require.cache[authHelpersPath] = {
    id: authHelpersPath,
    filename: authHelpersPath,
    loaded: true,
    exports: {
      verifyPassword: async () => true,
      normalizeUsername: (u) => String(u || '').trim().toLowerCase(),
      USERNAME_RE: /^[a-z0-9_]{3,32}$/,
      formatUserResponse: (row) => row,
      hashPassword: async () => 'hash',
      prisma: prismaMock,
    },
  };

  const router = require(require.resolve('./routes/appeals', { paths: [ROOT] }));
  const app = express();
  app.use(express.json());
  app.use('/api/appeals', router);
  return app;
}

const bannedUser = {
  _id: 'banned-1',
  username: 'banneduser',
  isBanned: true,
  platformRole: 'MEMBER',
  passwordHash: '$2a$10$abcdefghijklmnopqrstuv', // not used when mocked
};
const modUser = { _id: 'mod-1', username: 'moduser', isBanned: false, platformRole: 'MODERATOR' };

test('POST /api/appeals creates appeal for banned credentials', async () => {
  let created = false;
  const prismaMock = {
    user: {
      findUnique: async ({ where }) => {
        if (where.username === 'banneduser') {
          return {
            id: bannedUser._id,
            username: 'banneduser',
            isBanned: true,
            passwordHash: 'hash',
          };
        }
        return null;
      },
    },
    banAppeal: {
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }) => {
        created = true;
        assert.equal(data.userId, bannedUser._id);
        return {
          id: 'appeal-1',
          userId: data.userId,
          message: data.message,
          status: 'PENDING',
          moderatorNote: '',
          reviewedAt: null,
          createdAt: new Date(),
        };
      },
    },
  };

  const app = createAppealsApp(prismaMock);
  const res = await request(app, {
    method: 'POST',
    path: '/api/appeals',
    body: {
      username: 'banneduser',
      password: 'secret',
      message: 'I believe this ban was a mistake because of context.',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(created, true);
});

test('PATCH /api/appeals/:id accepts appeal and unbans user', async () => {
  let userUpdated = false;
  let auditCreated = false;
  const prismaMock = {
    banAppeal: {
      findUnique: async () => ({
        id: 'appeal-1',
        userId: bannedUser._id,
        status: 'PENDING',
        user: { id: bannedUser._id, bannedReason: 'spam' },
      }),
      update: async ({ data }) => ({
        id: 'appeal-1',
        userId: bannedUser._id,
        message: 'please review',
        status: data.status,
        moderatorNote: data.moderatorNote,
        reviewedAt: data.reviewedAt,
        createdAt: new Date(),
        user: { id: bannedUser._id, username: 'banneduser', displayName: 'Banned' },
        moderator: { id: modUser._id, username: modUser.username },
      }),
    },
    user: {
      update: async ({ data }) => {
        userUpdated = data.isBanned === false;
        return {};
      },
    },
    moderationAction: {
      create: async () => {
        auditCreated = true;
        return { id: 'audit-1' };
      },
    },
  };

  const app = createAppealsApp(prismaMock);
  const res = await request(app, {
    method: 'PATCH',
    path: '/api/appeals/appeal-1',
    headers: authHeader(modUser),
    body: { status: 'ACCEPTED', note: 'Reinstated after review' },
  });

  assert.equal(res.status, 200);
  assert.equal(userUpdated, true);
  assert.equal(auditCreated, true);
  assert.equal(res.json().appeal.status, 'ACCEPTED');
});
