const bcrypt = require('bcryptjs');
const userService = require('../services/users');
const threadService = require('../services/threads');
const categoryService = require('../services/categories');

/**
 * Optional demo content for local development (SEED_DEMO=true).
 */
async function seedDev() {
  if (process.env.SEED_DEMO !== 'true') return;
  if (process.env.NODE_ENV === 'production') return;

  const userCount = await userService.countUsers();
  if (userCount > 0) return;

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const physicist = await userService.createUser({
    username: 'physicist',
    displayName: 'A. Physicist',
    passwordHash,
  });
  const poet = await userService.createUser({
    username: 'poet',
    displayName: 'The Poet',
    passwordHash,
  });

  const physics = await categoryService.findCategoryBySlug('physics');
  const philosophy = await categoryService.findCategoryBySlug('philosophy');

  if (physics) {
    await threadService.createThread({
      title: 'What if consciousness is an emergent property we cannot reduce?',
      body:
        'Not looking for a definitive answer — looking for minds that approach this from different fields. What question would you ask first?',
      authorId: physicist._id,
      categoryId: physics._id,
    });
  }

  if (philosophy) {
    await threadService.createThread({
      title: 'Where does meaning live — in the symbol or in the collision of minds?',
      body: 'A poet and a programmer walk into a neuron. What do they build together?',
      authorId: poet._id,
      categoryId: philosophy._id,
    });
  }

  console.log('Demo users seeded (physicist / poet, password: demo1234)');
}

module.exports = seedDev;
