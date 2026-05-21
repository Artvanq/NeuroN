const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOwnerNamespace } = require('../utils/projectLookup');

test('resolveOwnerNamespace returns null for empty slug', async () => {
  const prismaPath = require.resolve('../utils/prisma');
  const prev = require.cache[prismaPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      user: { findUnique: async () => null },
      organization: { findUnique: async () => null },
    },
  };
  delete require.cache[require.resolve('../utils/projectLookup')];
  const mod = require('../utils/projectLookup');
  const result = await mod.resolveOwnerNamespace('');
  assert.equal(result, null);
  require.cache[prismaPath] = prev;
});
