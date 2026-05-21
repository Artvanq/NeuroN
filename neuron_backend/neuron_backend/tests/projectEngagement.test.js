const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTemplateName } = require('../utils/projectEngagement');

test('normalizeTemplateName trims and caps length', () => {
  assert.equal(normalizeTemplateName('  bug-report  '), 'bug-report');
  assert.equal(normalizeTemplateName('x'.repeat(80)).length, 48);
});
