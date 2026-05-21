const PlatformRole = {
  MEMBER: 'MEMBER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
};

const ROLE_PERMISSIONS = {
  [PlatformRole.MEMBER]: [],
  [PlatformRole.MODERATOR]: [
    'moderation.read',
    'moderation.write',
    'moderation.export',
  ],
  [PlatformRole.ADMIN]: [
    'moderation.read',
    'moderation.write',
    'moderation.export',
    'site.admin',
  ],
};

function parseUsernames(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRole(value) {
  const role = String(value || PlatformRole.MEMBER).toUpperCase();
  if (Object.values(PlatformRole).includes(role)) return role;
  return PlatformRole.MEMBER;
}

function envRoleForUser(user) {
  const username = String(user?.username || '').toLowerCase();
  if (!username) return null;

  const owner = (process.env.SITE_OWNER_USERNAME || '').trim().toLowerCase();
  if (owner && username === owner) return PlatformRole.ADMIN;

  const moderators = parseUsernames(process.env.MODERATOR_USERNAMES);
  if (moderators.includes(username)) return PlatformRole.MODERATOR;

  return null;
}

function resolveUserRole(user) {
  const stored = normalizeRole(user?.platformRole);
  if (stored !== PlatformRole.MEMBER) return stored;
  return envRoleForUser(user) || PlatformRole.MEMBER;
}

function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[normalizeRole(role)] || [])];
}

function getUserPermissions(user) {
  return permissionsForRole(resolveUserRole(user));
}

function hasPermission(user, permission) {
  if (!permission) return false;
  return getUserPermissions(user).includes(String(permission));
}

function canModerate(user) {
  return hasPermission(user, 'moderation.read');
}

function isSiteAdmin(user) {
  return hasPermission(user, 'site.admin');
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}

function requireModerator(_req, res, next) {
  if (!canModerate(_req.user)) {
    return res.status(403).json({ message: 'Moderator access required' });
  }
  return next();
}

module.exports = {
  PlatformRole,
  ROLE_PERMISSIONS,
  resolveUserRole,
  getUserPermissions,
  hasPermission,
  canModerate,
  isSiteAdmin,
  requirePermission,
  requireModerator,
};
