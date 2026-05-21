const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('./helpers/httpRequest');
const { createOrgsApp, authHeader, clearModuleCache } = require('./helpers/orgsRouteHarness');

const alice = { _id: 'user-1', username: 'alice', isBanned: false };

test.after(() => {
  clearModuleCache();
});

test('POST /api/orgs requires name', async () => {
  const app = createOrgsApp({ prismaMock: defaultOrgPrisma() });
  const res = await request(app, {
    method: 'POST',
    path: '/api/orgs',
    headers: authHeader(alice),
    body: {},
  });
  assert.equal(res.status, 400);
});

test('POST /api/orgs creates organization', async () => {
  const created = [];
  const prismaMock = defaultOrgPrisma({
    user: {
      findUnique: async () => null,
    },
    organization: {
      findUnique: async () => null,
      create: async ({ data }) => {
        created.push(data);
        return {
          id: 'org-1',
          slug: data.slug,
          name: data.name,
          description: data.description,
          avatarUrl: null,
          createdAt: new Date(),
        };
      },
    },
  });
  const app = createOrgsApp({ prismaMock });
  const res = await request(app, {
    method: 'POST',
    path: '/api/orgs',
    headers: authHeader(alice),
    body: { name: 'Neuron Labs', slug: 'neuron-labs' },
  });
  assert.equal(res.status, 201);
  assert.equal(created[0].slug, 'neuron-labs');
  assert.equal(res.json().slug, 'neuron-labs');
});

test('GET /api/orgs/mine returns memberships for current user', async () => {
  const org = {
    id: 'org-1',
    slug: 'neuron-labs',
    name: 'Neuron Labs',
    description: '',
    avatarUrl: null,
    createdAt: new Date(),
  };
  const prismaMock = defaultOrgPrisma({
    organizationMember: {
      findMany: async () => [
        {
          role: 'OWNER',
          organization: {
            ...org,
            _count: { members: 2, projects: 3 },
          },
        },
      ],
    },
  });
  const app = createOrgsApp({ prismaMock });
  const res = await request(app, {
    method: 'GET',
    path: '/api/orgs/mine',
    headers: authHeader({ _id: 'user-1', username: 'alice', isBanned: false }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.json().organizations.length, 1);
  assert.equal(res.json().organizations[0].viewerRole, 'OWNER');
});

test('GET /api/orgs/:slug/projects returns organization repos', async () => {
  const org = {
    id: 'org-1',
    slug: 'neuron-labs',
    name: 'Neuron Labs',
    description: '',
    avatarUrl: null,
    createdAt: new Date(),
  };
  const prismaMock = defaultOrgPrisma({
    organization: {
      findUnique: async ({ where }) => (where.slug === 'neuron-labs' ? org : null),
    },
    project: {
      findMany: async () => [
        {
          id: 'proj-1',
          slug: 'core',
          name: 'Core',
          description: 'Main repo',
          readme: '',
          organizationId: org.id,
          ownerId: 'user-1',
          owner: { id: 'user-1', username: 'alice', displayName: 'Alice', avatarUrl: null },
          organization: org,
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { issues: 1 },
        },
      ],
    },
    issue: { count: async () => 2 },
    pullRequest: { count: async () => 0 },
  });
  const app = createOrgsApp({ prismaMock });
  const res = await request(app, {
    method: 'GET',
    path: '/api/orgs/neuron-labs/projects',
  });
  assert.equal(res.status, 200);
  assert.equal(res.json().projects.length, 1);
  assert.equal(res.json().projects[0].slug, 'core');
  assert.equal(res.json().projects[0].ownerUsername, 'neuron-labs');
});

function defaultOrgPrisma(overrides = {}) {
  return {
    user: {
      findUnique: async () => null,
      ...overrides.user,
    },
    organization: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      ...overrides.organization,
    },
    organizationMember: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async () => ({}),
      delete: async () => ({}),
      ...overrides.organizationMember,
    },
    project: {
      findMany: async () => [],
      ...overrides.project,
    },
    issue: {
      count: async () => 0,
      ...overrides.issue,
    },
    pullRequest: {
      count: async () => 0,
      ...overrides.pullRequest,
    },
    ...overrides,
  };
}
