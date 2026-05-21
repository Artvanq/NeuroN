const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');

test('searchUsers returns empty array for short query', async () => {
  const usersPath = require.resolve('./services/users', { paths: [ROOT] });
  delete require.cache[usersPath];

  const userService = require('../services/users');
  const rows = await userService.searchUsers({ query: '  ', limit: 10 });
  assert.deepEqual(rows, []);

  delete require.cache[usersPath];
});

test('searchUsers maps prisma rows to API shape', async () => {
  const prismaPath = require.resolve('./utils/prisma', { paths: [ROOT] });
  const usersPath = require.resolve('./services/users', { paths: [ROOT] });

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      user: {
        findMany: async () => [
          {
            id: 'u1',
            username: 'alice',
            displayName: 'Alice',
            mindStatement: 'curious',
          },
        ],
      },
    },
  };

  delete require.cache[usersPath];
  const userService = require('../services/users');
  const rows = await userService.searchUsers({ query: 'ali', limit: 5 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]._id, 'u1');
  assert.equal(rows[0].username, 'alice');

  delete require.cache[prismaPath];
  delete require.cache[usersPath];
});
