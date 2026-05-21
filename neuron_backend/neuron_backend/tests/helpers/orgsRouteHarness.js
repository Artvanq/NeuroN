const path = require('path');
const express = require('express');

const ROOT = path.join(__dirname, '../..');

const MODULE_REL = [
  './routes/orgs',
  './middleware/auth',
  './middleware/rateLimit',
  './utils/prisma',
  './utils/projectLookup',
  './utils/orgAccess',
];

function clearModuleCache() {
  MODULE_REL.forEach((rel) => {
    try {
      delete require.cache[require.resolve(rel, { paths: [ROOT] })];
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
      optionalAuth: (req, _res, next) => {
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

function createOrgsApp({ prismaMock, user = { _id: 'user-1', username: 'alice', isBanned: false } }) {
  clearModuleCache();
  installAuthMock(user);
  installPrismaMock(prismaMock);
  const app = express();
  app.use(express.json());
  const router = require(require.resolve('./routes/orgs', { paths: [ROOT] }));
  app.use('/api/orgs', router);
  return app;
}

function authHeader(user) {
  return { 'x-test-user': JSON.stringify(user) };
}

module.exports = {
  clearModuleCache,
  createOrgsApp,
  authHeader,
};
