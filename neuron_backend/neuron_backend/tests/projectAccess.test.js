const test = require('node:test');
const assert = require('node:assert/strict');

const { permissionsForRole, NO_ACCESS } = require('../utils/projectAccess');

test('permissionsForRole grants merge only to maintainer and owner', () => {
  assert.equal(permissionsForRole('READ').merge, false);
  assert.equal(permissionsForRole('WRITE').merge, false);
  assert.equal(permissionsForRole('MAINTAINER').merge, true);
  assert.equal(permissionsForRole('OWNER').merge, true);
});

test('permissionsForRole grants write from WRITE upward', () => {
  assert.equal(permissionsForRole('READ').write, false);
  assert.equal(permissionsForRole('WRITE').write, true);
  assert.equal(permissionsForRole('MAINTAINER').write, true);
});

test('NO_ACCESS blocks private project reads', () => {
  assert.equal(NO_ACCESS.read, false);
  assert.equal(NO_ACCESS.write, false);
});
