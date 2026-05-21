const { resolveGitUser } = require('../middleware/gitAuth');
const {
  resolveProjectAccess,
  requireProjectPermission,
  permissionsForRole,
} = require('./projectAccess');
const { formatBanErrorBody } = require('./banSanction');

async function resolveGitReadContext(req, res, project) {
  const visibility = project.visibility || 'PUBLIC';

  if (visibility !== 'PRIVATE') {
    const user = await resolveGitUser(req, { requiredScope: 'git:read' });
    if (user?.isBanned) {
      res.status(403).json(formatBanErrorBody(user));
      return null;
    }
    const access = user
      ? await resolveProjectAccess(user._id, project)
      : permissionsForRole('READ');
    return { user: user || null, access };
  }

  const user = await resolveGitUser(req, { requiredScope: 'git:read' });
  if (!user) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Neuron Git"');
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }
  if (user.isBanned) {
    res.status(403).json(formatBanErrorBody(user));
    return null;
  }

  const access = await resolveProjectAccess(user._id, project);
  try {
    requireProjectPermission(access, 'read');
  } catch (err) {
    res.status(403).json({ message: err.message || 'Not allowed' });
    return null;
  }

  return { user, access };
}

module.exports = { resolveGitReadContext };
