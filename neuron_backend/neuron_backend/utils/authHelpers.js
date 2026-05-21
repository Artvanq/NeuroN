const bcrypt = require('bcryptjs');
const prisma = require('./prisma');
const { resolveUserRole, getUserPermissions } = require('./rbac');
const { normalizeNotificationPreferences } = require('./notificationPreferences');

const SALT_ROUNDS = 10;
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function formatUserResponse(row) {
  if (!row) return null;
  return {
    _id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl || null,
    profileUrl: row.profileUrl || null,
    email: row.email || null,
    emailVerified: Boolean(row.emailVerifiedAt),
    isBanned: Boolean(row.isBanned),
    bannedReason: row.bannedReason || '',
    bannedAt: row.bannedAt || null,
    mindStatement: row.mindStatement,
    onboardingCompleted: row.onboardingCompleted,
    contentLocale: row.contentLocale || '',
    invitesRemaining: row.invitesRemaining ?? 0,
    profileVisibility: row.profileVisibility || 'OPEN',
    platformRole: resolveUserRole(row),
    permissions: getUserPermissions(row),
    notificationPreferences: normalizeNotificationPreferences(row.notificationPreferences),
    totpEnabled: Boolean(row.totpEnabledAt),
    createdAt: row.createdAt,
    linkedProviders: (row.oauthAccounts || []).map((a) => a.provider.toLowerCase()),
    interestedCategories: (row.interestedCategories || []).map((c) => ({
      _id: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
    })),
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = {
  SALT_ROUNDS,
  USERNAME_RE,
  normalizeUsername,
  formatUserResponse,
  hashPassword,
  verifyPassword,
  prisma,
};
