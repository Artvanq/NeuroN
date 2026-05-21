const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMergeMethod, MERGE_METHODS } = require('../utils/prMerge');
const { validateInlineComment } = require('../utils/prReviewComments');

test('normalizeMergeMethod accepts merge squash rebase', () => {
  assert.equal(normalizeMergeMethod('squash'), 'squash');
  assert.equal(normalizeMergeMethod('REBASE'), 'rebase');
  assert.equal(normalizeMergeMethod('invalid'), 'merge');
  assert.deepEqual(MERGE_METHODS, ['merge', 'squash', 'rebase']);
});

test('validateInlineComment requires path line and body', () => {
  assert.throws(() => validateInlineComment({ path: '', line: 1, body: 'hi' }), /path/i);
  assert.throws(() => validateInlineComment({ path: 'a.js', line: 0, body: 'hi' }), /line/i);
  const ok = validateInlineComment({ path: 'src/a.js', line: 3, body: ' fix typo ' });
  assert.equal(ok.path, 'src/a.js');
  assert.equal(ok.line, 3);
  assert.equal(ok.body, 'fix typo');
});
