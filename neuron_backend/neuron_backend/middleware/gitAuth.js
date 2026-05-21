const { getUserFromRequest } = require('./auth');
const userService = require('../services/users');
const { verifyPassword } = require('../utils/authHelpers');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/jwtSecret');
const { formatBanErrorBody } = require('../utils/banSanction');
const { isPersonalAccessToken, authenticatePersonalAccessToken } = require('../utils/pat');

async function authenticateBasicAuth(header, { requiredScope = 'git:write' } = {}) {
  if (!header?.startsWith('Basic ')) return null;
  let decoded = '';
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  const username = decoded.slice(0, sep).trim().toLowerCase();
  const secret = decoded.slice(sep + 1);
  if (!secret) return null;

  if (isPersonalAccessToken(secret)) {
    const auth = await authenticatePersonalAccessToken(secret, { requiredScope });
    if (!auth?.user) return null;
    if (username && username !== 'x-access-token' && username !== auth.user.username) {
      return null;
    }
    return auth.user;
  }

  if (!username) return null;
  const row = await userService.findUserByUsername(username);
  if (!row) return null;

  if (row.passwordHash) {
    const valid = await verifyPassword(secret, row.passwordHash);
    if (valid) return row;
  }

  try {
    const payload = jwt.verify(secret, JWT_SECRET);
    if (payload.type && payload.type !== 'access') return null;
    if (String(payload.userId) !== String(row._id)) return null;
    return row;
  } catch {
    return null;
  }
}

async function resolveGitUser(req, { requiredScope = 'git:write' } = {}) {
  const header = req.headers.authorization || '';

  if (header.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (isPersonalAccessToken(token)) {
      const auth = await authenticatePersonalAccessToken(token, { requiredScope });
      return auth?.user || null;
    }
    const user = await getUserFromRequest(req);
    return user;
  }

  if (header.startsWith('Basic ')) {
    return authenticateBasicAuth(header, { requiredScope });
  }

  const cookieUser = await getUserFromRequest(req);
  return cookieUser;
}

async function requireGitAuth(req, res, next) {
  try {
    const user = await resolveGitUser(req, { requiredScope: 'git:write' });
    if (!user) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Neuron Git"');
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (user.isBanned) {
      return res.status(403).json(formatBanErrorBody(user));
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireGitAuth,
  authenticateBasicAuth,
  resolveGitUser,
};
