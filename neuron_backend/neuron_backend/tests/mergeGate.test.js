const test = require('node:test');
const assert = require('node:assert/strict');

const { countApprovals, evaluateMergeGate } = require('../utils/mergeGate');

test('evaluateMergeGate blocks draft pull requests', async () => {
  const gate = await evaluateMergeGate('proj-1', {
    isDraft: true,
    number: 3,
    authorId: 'user-1',
    headBranch: 'feat',
  });
  assert.equal(gate.ok, false);
  assert.equal(gate.checks.draft.ok, false);
  assert.match(gate.message, /draft/i);
});

test('countApprovals uses latest review per reviewer and ignores author self-approval', async () => {
  const prismaPath = require.resolve('../utils/prisma');
  const original = require.cache[prismaPath];

  const reviews = [
    {
      reviewerId: 'mod-1',
      state: 'APPROVED',
      createdAt: new Date('2026-01-02'),
    },
    {
      reviewerId: 'mod-1',
      state: 'CHANGES_REQUESTED',
      createdAt: new Date('2026-01-03'),
    },
    {
      reviewerId: 'author-1',
      state: 'APPROVED',
      createdAt: new Date('2026-01-04'),
    },
    {
      reviewerId: 'mod-2',
      state: 'APPROVED',
      createdAt: new Date('2026-01-05'),
    },
  ];

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      pullRequestReview: {
        findMany: async () => reviews,
      },
    },
  };

  delete require.cache[require.resolve('../utils/mergeGate')];
  const { countApprovals: count } = require('../utils/mergeGate');
  const result = await count('pr-1', 'author-1');
  assert.equal(result.approvals, 1);
  assert.equal(result.changesRequested, true);

  if (original) require.cache[prismaPath] = original;
  else delete require.cache[prismaPath];
  delete require.cache[require.resolve('../utils/mergeGate')];
});
