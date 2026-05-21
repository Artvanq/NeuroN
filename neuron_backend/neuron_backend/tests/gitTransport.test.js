const test = require('node:test');
const assert = require('node:assert/strict');
const {
  serviceAdvertisement,
  isProtectedBranchPushAllowed,
  isGitAvailable,
} = require('../utils/gitTransport');
const { permissionsForRole } = require('../utils/projectAccess');

test('serviceAdvertisement wraps git service header in pkt-lines', () => {
  const body = Buffer.from('ref advertisement\n');
  const out = serviceAdvertisement('git-receive-pack', body);
  const text = out.toString('utf8');
  assert.match(text, /^[0-9a-f]{4}# service=git-receive-pack/);
  assert.ok(text.includes('ref advertisement'));
  assert.ok(out.includes(Buffer.from('0000')));
});

test('isProtectedBranchPushAllowed blocks writers on protected branches', () => {
  const protection = { requireCiSuccess: true, requireReview: true };
  assert.equal(isProtectedBranchPushAllowed(protection, permissionsForRole('WRITE')), false);
  assert.equal(isProtectedBranchPushAllowed(protection, permissionsForRole('MAINTAINER')), true);
  assert.equal(isProtectedBranchPushAllowed(null, permissionsForRole('WRITE')), true);
});

test('isGitAvailable resolves boolean', async () => {
  const ok = await isGitAvailable();
  assert.equal(typeof ok, 'boolean');
});
