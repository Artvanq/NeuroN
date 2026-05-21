const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileTags } = require('../utils/recommendations');

test('profileTags returns empty array for invalid input', () => {
  assert.deepEqual(profileTags(null), []);
  assert.deepEqual(profileTags({}), []);
  assert.deepEqual(profileTags({ tags: 'nope' }), []);
});

test('profileTags extracts string tags', () => {
  assert.deepEqual(profileTags({ tags: ['physics', 'poetry', ''] }), ['physics', 'poetry']);
});
