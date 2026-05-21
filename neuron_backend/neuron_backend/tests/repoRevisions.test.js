const test = require('node:test');
const assert = require('node:assert/strict');
const { computeBlameLines } = require('../utils/repoRevisions');

test('computeBlameLines attributes lines to latest matching revision', () => {
  const revisions = [
    {
      id: 'r1',
      content: 'line one\nline two',
      createdAt: new Date('2026-01-01'),
      author: { id: 'u1', username: 'alice', displayName: 'Alice' },
    },
    {
      id: 'r2',
      content: 'line one\nline two changed',
      createdAt: new Date('2026-01-02'),
      author: { id: 'u2', username: 'bob', displayName: 'Bob' },
    },
  ];

  const lines = computeBlameLines(revisions, 'line one\nline two changed');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].author.username, 'alice');
  assert.equal(lines[1].author.username, 'bob');
  assert.equal(lines[0].revisionId, 'r1');
  assert.equal(lines[1].revisionId, 'r2');
});

test('computeBlameLines uses fallback when no revisions', () => {
  const lines = computeBlameLines([], 'hello', {
    updatedAt: new Date('2026-01-03'),
    updatedBy: { id: 'u3', username: 'carol', displayName: 'Carol' },
  });
  assert.equal(lines[0].author.username, 'carol');
});
