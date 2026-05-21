const path = require('path');
const express = require('express');

const ROOT = path.join(__dirname, '../..');

const MODULE_REL = [
  './routes/auth',
  './middleware/rateLimit',
  './utils/prisma',
  './utils/redis',
  './utils/authHelpers',
  './utils/email',
  './utils/sessions',
  './utils/invites',
  './utils/captcha',
  './utils/analyticsOutbox',
  './utils/interestProfile',
  './services/users',
  './services/categories',
];

function clearModuleCache() {
  MODULE_REL.forEach((rel) => {
    try {
      const resolved = require.resolve(rel, { paths: [ROOT] });
      delete require.cache[resolved];
    } catch {
      /* not loaded */
    }
  });
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

function installRateLimitNoop() {
  const ratePath = require.resolve('./middleware/rateLimit', { paths: [ROOT] });
  require.cache[ratePath] = {
    id: ratePath,
    filename: ratePath,
    loaded: true,
    exports: {
      authRateLimit: (_req, _res, next) => next(),
      apiRateLimit: (_req, _res, next) => next(),
    },
  };
}

function installRedisMock() {
  const redisPath = require.resolve('./utils/redis', { paths: [ROOT] });
  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
      getRedis: () => null,
      pingRedis: async () => false,
      getRedisPubSub: () => ({ pub: null, sub: null }),
    },
  };
}

function installEmailMock(sendEmail = async () => {}) {
  const emailPath = require.resolve('./utils/email', { paths: [ROOT] });
  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: {
      sendEmail,
      makeUrl: (p, q) => `https://example.test${p}?${new URLSearchParams(q).toString()}`,
    },
  };
}

function createAuthApp({ prismaMock, sendEmail }) {
  clearModuleCache();
  installRateLimitNoop();
  installRedisMock();
  installPrismaMock(prismaMock);
  installEmailMock(sendEmail);
  const app = express();
  app.use(express.json());
  const authRouter = require(require.resolve('./routes/auth', { paths: [ROOT] }));
  app.use('/api/auth', authRouter);
  return app;
}

module.exports = {
  clearModuleCache,
  createAuthApp,
};
