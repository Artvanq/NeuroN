const prisma = require('./prisma');
const { PlatformRole } = require('./rbac');

function parseUsernames(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Promotes users listed in env to platform roles (non-destructive downgrade).
 * SITE_OWNER_USERNAME -> ADMIN; MODERATOR_USERNAMES -> MODERATOR (if still MEMBER).
 */
async function syncPlatformRolesFromEnv() {
  const owner = (process.env.SITE_OWNER_USERNAME || '').trim().toLowerCase();
  const moderators = parseUsernames(process.env.MODERATOR_USERNAMES);

  if (owner) {
    await prisma.user.updateMany({
      where: { username: { equals: owner, mode: 'insensitive' } },
      data: { platformRole: PlatformRole.ADMIN },
    });
  }

  for (const username of moderators) {
    await prisma.user.updateMany({
      where: {
        username: { equals: username, mode: 'insensitive' },
        platformRole: PlatformRole.MEMBER,
      },
      data: { platformRole: PlatformRole.MODERATOR },
    });
  }
}

module.exports = { syncPlatformRolesFromEnv };
