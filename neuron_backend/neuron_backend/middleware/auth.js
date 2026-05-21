const jwt = require('jsonwebtoken');
const userService = require('../services/users');
const { JWT_SECRET } = require('../utils/jwtSecret');
const { signAccessToken } = require('../utils/sessions');
const { formatBanErrorBody } = require('../utils/banSanction');
const { isPersonalAccessToken, authenticatePersonalAccessToken } = require('../utils/pat');

function signToken(userId) {
  return signAccessToken(userId);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (user.isBanned) {
      return res.status(403).json(formatBanErrorBody(user));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, _res, next) {
  try {
    const user = await getUserFromRequest(req);
    req.user = user?.isBanned ? null : user;
    next();
  } catch (err) {
    next(err);
  }
}

async function getUserFromRequest(req) {
  const header = req.headers.authorization;
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) return null;

  if (isPersonalAccessToken(token)) {
    const auth = await authenticatePersonalAccessToken(token, { requiredScope: 'api:read' });
    return auth?.user || null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type && payload.type !== 'access') {
      return null;
    }
    return userService.getUserById(payload.userId);
  } catch {
    return null;
  }
}

async function requireAuthIncludingBanned(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function attachUserIncludingBanned(req, _res, next) {
  try {
    req.user = (await getUserFromRequest(req)) || null;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  signToken,
  requireAuth,
  optionalAuth,
  requireAuthIncludingBanned,
  attachUserIncludingBanned,
  getUserFromRequest,
};
