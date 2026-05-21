const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCategorySlug, normalizeCategoryName } = require('../utils/categoryCreate');

test('normalizeCategorySlug slugifies and rejects reserved', () => {
  assert.equal(normalizeCategorySlug('  My Field  '), 'my-field');
  assert.equal(normalizeCategorySlug('admin'), '');
  assert.equal(normalizeCategorySlug('x'), '');
});

test('normalizeCategoryName trims and caps length', () => {
  assert.equal(normalizeCategoryName('  Quantum  '), 'Quantum');
  assert.equal(normalizeCategoryName('n'.repeat(100)).length, 80);
});
