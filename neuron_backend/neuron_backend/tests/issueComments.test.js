const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIssueCommentBody } = require('../utils/issueComments');

test('normalizeIssueCommentBody trims and caps length', () => {
  assert.equal(normalizeIssueCommentBody('  hello  '), 'hello');
  assert.equal(normalizeIssueCommentBody('x'.repeat(40000)).length, 32000);
});

test('normalizeIssueCommentBody rejects empty', () => {
  assert.equal(normalizeIssueCommentBody('   '), '');
});
