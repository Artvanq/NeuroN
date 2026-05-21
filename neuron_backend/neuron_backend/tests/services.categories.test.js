const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');

test('findCategoryBySlug returns formatted category', async () => {
  const prismaPath = require.resolve('./utils/prisma', { paths: [ROOT] });
  const categoriesPath = require.resolve('./services/categories', { paths: [ROOT] });
  const originalPrisma = require.cache[prismaPath];

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      category: {
        findUnique: async ({ where }) => {
          if (where.slug === 'physics') {
            return {
              id: 'cat-1',
              slug: 'physics',
              name: 'Physics',
              description: '',
              icon: '⚛',
              color: '#38bdf8',
              createdAt: new Date(),
            };
          }
          return null;
        },
      },
    },
  };

  delete require.cache[categoriesPath];
  const categoryService = require('../services/categories');

  const cat = await categoryService.findCategoryBySlug('physics');
  assert.equal(cat._id, 'cat-1');
  assert.equal(cat.slug, 'physics');

  if (originalPrisma) require.cache[prismaPath] = originalPrisma;
  else delete require.cache[prismaPath];
  delete require.cache[categoriesPath];
});
