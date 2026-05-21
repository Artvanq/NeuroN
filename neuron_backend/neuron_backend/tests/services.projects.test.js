const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');

test('searchProjects returns empty array for short query', async () => {
  const projectsPath = require.resolve('./services/projects', { paths: [ROOT] });
  delete require.cache[projectsPath];

  const projectService = require('../services/projects');
  const rows = await projectService.searchProjects({ query: 'a', limit: 10 });
  assert.deepEqual(rows, []);

  delete require.cache[projectsPath];
});

test('searchProjects maps prisma rows to API shape', async () => {
  const prismaPath = require.resolve('./utils/prisma', { paths: [ROOT] });
  const projectsPath = require.resolve('./services/projects', { paths: [ROOT] });

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      project: {
        findMany: async () => [
          {
            id: 'proj-1',
            slug: 'neural-net',
            name: 'Neural Net',
            description: 'experiments',
            readme: '',
            defaultBranch: 'main',
            createdAt: new Date(),
            updatedAt: new Date(),
            owner: { id: 'u1', username: 'alice', displayName: 'Alice' },
            category: null,
            _count: { issues: 2 },
          },
        ],
      },
      issue: { count: async () => 1 },
      pullRequest: { count: async () => 0 },
    },
  };

  delete require.cache[projectsPath];
  const projectService = require('../services/projects');
  const rows = await projectService.searchProjects({ query: 'neural', limit: 5 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]._id, 'proj-1');
  assert.equal(rows[0].slug, 'neural-net');
  assert.equal(rows[0].ownerUsername, 'alice');
  assert.equal(rows[0].openIssueCount, 1);

  delete require.cache[prismaPath];
  delete require.cache[projectsPath];
});
