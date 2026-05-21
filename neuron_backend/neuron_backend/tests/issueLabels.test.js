const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLabelName,
  normalizeLabelColor,
  formatIssueLabels,
} = require('../utils/issueLabels');

test('normalizeLabelName trims and caps length', () => {
  assert.equal(normalizeLabelName('  bug  '), 'bug');
  assert.equal(normalizeLabelName('x'.repeat(80)).length, 48);
});

test('formatIssueLabels maps junction rows', () => {
  const rows = formatIssueLabels([
    { label: { id: 'l1', name: 'bug', color: '#ff0000', createdAt: new Date() } },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'bug');
});
