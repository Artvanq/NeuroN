const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPersonalAccessToken,
  hashToken,
  normalizeScopes,
  generateTokenValue,
  tokenHasScope,
  ALL_SCOPES,
} = require('../utils/pat');

test('generateTokenValue uses nrn_ prefix', () => {
  const token = generateTokenValue();
  assert.ok(isPersonalAccessToken(token));
  assert.ok(token.length > 40);
});

test('hashToken is deterministic sha256 hex', () => {
  const a = hashToken('nrn_test');
  const b = hashToken('nrn_test');
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('normalizeScopes filters unknown and defaults when empty', () => {
  assert.deepEqual(normalizeScopes(['git:write', 'nope']), ['git:write']);
  assert.deepEqual(normalizeScopes([]), ['git:read', 'git:write']);
  assert.deepEqual(normalizeScopes(ALL_SCOPES), ALL_SCOPES);
});

test('tokenHasScope grants git:read via git:write', () => {
  const row = { scopes: ['git:write'] };
  assert.equal(tokenHasScope(row, 'git:read'), true);
  assert.equal(tokenHasScope(row, 'api:read'), false);
});
