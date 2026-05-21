const path = require('path');
const express = require('express');

const ROOT = path.join(__dirname, '../..');

const MODULE_REL = [
  './routes/push',
  './middleware/auth',
  './middleware/rateLimit',
  './utils/prisma',
  './utils/webPush',
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

function installAuthMock(user) {
  const authPath = require.resolve('./middleware/auth', { paths: [ROOT] });
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      requireAuth: (req, _res, next) => {
        req.user = user;
        next();
      },
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

function installWebPushMock(configured = true) {
  const wpPath = require.resolve('./utils/webPush', { paths: [ROOT] });
  require.cache[wpPath] = {
    id: wpPath,
    filename: wpPath,
    loaded: true,
    exports: {
      isWebPushConfigured: () => configured,
      getVapidPublicKey: () => (configured ? 'test-public-key' : null),
      sendWebPushToUser: async () => ({ sent: 0, failed: 0 }),
    },
  };
}

function createPushApp({ prismaMock, user, webPushConfigured = true }) {
  clearModuleCache();
  installAuthMock(user);
  installPrismaMock(prismaMock);
  installWebPushMock(webPushConfigured);
  const app = express();
  app.use(express.json());
  const router = require(require.resolve('./routes/push', { paths: [ROOT] }));
  app.use('/api/push', router);
  return app;
}

function authHeader(user) {
  return { 'x-test-user': JSON.stringify(user) };
}

module.exports = {
  clearModuleCache,
  createPushApp,
  authHeader,
};
