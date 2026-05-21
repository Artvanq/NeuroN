const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMilestoneTitle } = require('../utils/issueExtras');

test('normalizeMilestoneTitle trims and caps length', () => {
  assert.equal(normalizeMilestoneTitle('  v1.0  '), 'v1.0');
  assert.equal(normalizeMilestoneTitle('x'.repeat(200)).length, 120);
});
