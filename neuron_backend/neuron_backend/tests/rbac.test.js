const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveUserRole,
  getUserPermissions,
  hasPermission,
  canModerate,
  isSiteAdmin,
  PlatformRole,
} = require('../utils/rbac');

test('resolveUserRole uses stored role and env bootstrap for MEMBER', () => {
  const original = process.env.MODERATOR_USERNAMES;
  process.env.MODERATOR_USERNAMES = 'env-only-mod';
  try {
    assert.equal(
      resolveUserRole({ username: 'plain-member', platformRole: PlatformRole.MEMBER }),
      PlatformRole.MEMBER
    );
    assert.equal(
      resolveUserRole({ username: 'env-only-mod', platformRole: PlatformRole.MEMBER }),
      PlatformRole.MODERATOR
    );
    assert.equal(
      resolveUserRole({ username: 'bob', platformRole: PlatformRole.MODERATOR }),
      PlatformRole.MODERATOR
    );
    assert.equal(
      resolveUserRole({ username: 'env-only-mod', platformRole: PlatformRole.ADMIN }),
      PlatformRole.ADMIN
    );
  } finally {
    if (original === undefined) delete process.env.MODERATOR_USERNAMES;
    else process.env.MODERATOR_USERNAMES = original;
  }
});

test('env fallbacks grant moderator and admin roles', () => {
  const original = {
    MODERATOR_USERNAMES: process.env.MODERATOR_USERNAMES,
    SITE_OWNER_USERNAME: process.env.SITE_OWNER_USERNAME,
  };
  process.env.MODERATOR_USERNAMES = 'mod1,mod2';
  process.env.SITE_OWNER_USERNAME = 'owner1';
  try {
    assert.equal(resolveUserRole({ username: 'mod1' }), PlatformRole.MODERATOR);
    assert.equal(resolveUserRole({ username: 'owner1' }), PlatformRole.ADMIN);
    assert.equal(resolveUserRole({ username: 'guest' }), PlatformRole.MEMBER);
  } finally {
    Object.entries(original).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  }
});

test('permissions map to role capabilities', () => {
  const modPerms = getUserPermissions({ platformRole: PlatformRole.MODERATOR });
  assert.equal(canModerate({ platformRole: PlatformRole.MODERATOR }), true);
  assert.equal(isSiteAdmin({ platformRole: PlatformRole.MODERATOR }), false);
  assert.equal(hasPermission({ platformRole: PlatformRole.MODERATOR }, 'moderation.export'), true);
  assert.equal(modPerms.includes('site.admin'), false);

  const adminPerms = getUserPermissions({ platformRole: PlatformRole.ADMIN });
  assert.equal(isSiteAdmin({ platformRole: PlatformRole.ADMIN }), true);
  assert.equal(adminPerms.includes('site.admin'), true);
});
