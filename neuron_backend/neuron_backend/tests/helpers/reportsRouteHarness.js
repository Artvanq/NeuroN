const path = require('path');
const express = require('express');

const ROOT = path.join(__dirname, '../..');

const MODULE_REL = [
  './routes/reports',
  './middleware/auth',
  './middleware/rateLimit',
  './utils/prisma',
  './utils/redis',
  './utils/notify',
  './utils/captcha',
  './utils/moderationPolicy',
];

function clearModuleCache() {
  MODULE_REL.forEach((rel) => {
    try {
      const resolved = require.resolve(rel, { paths: [ROOT] });
      delete require.cache[resolved];
    } catch {
      /* module was not loaded yet */
    }
  });
}

function defaultPrismaMock(overrides = {}) {
  const base = {
    report: {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }) => ({
        id: 'report-created',
        reporterId: data.reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        status: 'open',
        createdAt: new Date(),
      }),
      update: async ({ data }) => ({ id: 'report-updated', status: data.status, createdAt: new Date() }),
    },
    moderationAction: {
      count: async () => 0,
      findMany: async () => [],
      create: async ({ data }) => ({ id: 'mod-action-1', ...data }),
    },
    user: {
      findUnique: async () => null,
      update: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
    organization: {
      findUnique: async () => null,
    },
    thread: {
      findUnique: async () => null,
      update: async () => ({}),
    },
    reply: {
      findUnique: async () => null,
      update: async () => ({}),
    },
    message: {
      findUnique: async () => null,
    },
    project: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
  };
  return { ...base, ...overrides };
}

function installAuthMock() {
  const authPath = require.resolve('./middleware/auth', { paths: [ROOT] });
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      requireAuth(req, res, next) {
        const raw = req.headers['x-test-user'];
        if (!raw) {
          return res.status(401).json({ message: 'Authentication required' });
        }
        try {
          req.user = JSON.parse(raw);
        } catch {
          return res.status(401).json({ message: 'Authentication required' });
        }
        if (req.user.isBanned) {
          return res.status(403).json({
            message: req.user.bannedReason
              ? `Account is banned: ${req.user.bannedReason}`
              : 'Account is banned',
          });
        }
        return next();
      },
      optionalAuth(req, _res, next) {
        next();
      },
      signToken: () => 'test-token',
    },
  };
}

function installPrismaMock(prismaMock) {
  const prismaPath = require.resolve('./utils/prisma', { paths: [ROOT] });
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
}

function installRedisMock(redisClient) {
  const redisPath = require.resolve('./utils/redis', { paths: [ROOT] });
  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
      isRedisAvailable: () => Boolean(redisClient),
      getRedis: () => redisClient,
      isRedisConfigured: () => Boolean(redisClient),
      connectRedis: async () => Boolean(redisClient),
      pingRedis: async () => Boolean(redisClient),
      getRedisPubSub: () => ({ pub: null, sub: null }),
    },
  };
}

function installNotifyMock() {
  const notifyPath = require.resolve('./utils/notify', { paths: [ROOT] });
  require.cache[notifyPath] = {
    id: notifyPath,
    filename: notifyPath,
    loaded: true,
    exports: {
      createNotification: async () => null,
    },
  };
}

function createReportsApp({
  prismaMock = defaultPrismaMock(),
  redisClient = null,
  moderatorUsernames = 'moduser',
} = {}) {
  if (moderatorUsernames != null) {
    process.env.MODERATOR_USERNAMES = moderatorUsernames;
  }

  clearModuleCache();
  installAuthMock();
  installPrismaMock(prismaMock);
  installNotifyMock();
  if (redisClient) installRedisMock(redisClient);

  const router = require(require.resolve('./routes/reports', { paths: [ROOT] }));
  const app = express();
  app.use(express.json());
  app.use('/api/reports', router);
  return app;
}

function authHeader(user) {
  return { 'x-test-user': JSON.stringify(user) };
}

module.exports = {
  clearModuleCache,
  createReportsApp,
  defaultPrismaMock,
  authHeader,
};
