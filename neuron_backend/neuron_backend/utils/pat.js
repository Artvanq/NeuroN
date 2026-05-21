const crypto = require('crypto');
const prisma = require('./prisma');
const userService = require('../services/users');

const TOKEN_PREFIX = 'nrn_';
const MAX_TOKENS_PER_USER = 25;

const ALL_SCOPES = ['git:read', 'git:write', 'api:read'];

const DEFAULT_SCOPES = ['git:read', 'git:write'];

function isPersonalAccessToken(value) {
  return typeof value === 'string' && value.startsWith(TOKEN_PREFIX) && value.length >= 20;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeScopes(input) {
  const raw = Array.isArray(input) ? input : DEFAULT_SCOPES;
  const scopes = [...new Set(raw.map((s) => String(s).trim()).filter((s) => ALL_SCOPES.includes(s)))];
  return scopes.length > 0 ? scopes : [...DEFAULT_SCOPES];
}

function generateTokenValue() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

function formatTokenRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function tokenHasScope(tokenRow, scope) {
  if (!tokenRow?.scopes?.length) return false;
  if (tokenRow.scopes.includes(scope)) return true;
  if (scope === 'git:read' && tokenRow.scopes.includes('git:write')) return true;
  return false;
}

async function createPersonalAccessToken(userId, { label, scopes, expiresInDays } = {}) {
  const cleanLabel = String(label || '').trim().slice(0, 80);
  if (!cleanLabel) {
    throw Object.assign(new Error('Token label is required'), { status: 400 });
  }

  const count = await prisma.personalAccessToken.count({ where: { userId: String(userId) } });
  if (count >= MAX_TOKENS_PER_USER) {
    throw Object.assign(new Error(`Maximum ${MAX_TOKENS_PER_USER} tokens per account`), { status: 400 });
  }

  const token = generateTokenValue();
  const tokenHash = hashToken(token);
  const tokenPrefix = token.slice(0, TOKEN_PREFIX.length + 8);
  const normalizedScopes = normalizeScopes(scopes);

  let expiresAt = null;
  if (expiresInDays != null && Number(expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);
  }

  const row = await prisma.personalAccessToken.create({
    data: {
      userId: String(userId),
      label: cleanLabel,
      tokenPrefix,
      tokenHash,
      scopes: normalizedScopes,
      expiresAt,
    },
  });

  return {
    token,
    record: formatTokenRow(row),
  };
}

async function listPersonalAccessTokens(userId) {
  const rows = await prisma.personalAccessToken.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(formatTokenRow);
}

async function revokePersonalAccessToken(userId, tokenId) {
  const row = await prisma.personalAccessToken.findFirst({
    where: { id: String(tokenId), userId: String(userId) },
  });
  if (!row) {
    throw Object.assign(new Error('Token not found'), { status: 404 });
  }
  await prisma.personalAccessToken.delete({ where: { id: row.id } });
  return { message: 'Token revoked' };
}

async function authenticatePersonalAccessToken(rawToken, { requiredScope } = {}) {
  if (!isPersonalAccessToken(rawToken)) return null;

  const tokenHash = hashToken(rawToken);
  const row = await prisma.personalAccessToken.findUnique({
    where: { tokenHash },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  if (requiredScope && !tokenHasScope(row, requiredScope)) return null;

  const user = await userService.getUserById(row.userId);
  if (!user || user.isBanned) return null;

  prisma.personalAccessToken
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return { user, token: row };
}

module.exports = {
  TOKEN_PREFIX,
  ALL_SCOPES,
  DEFAULT_SCOPES,
  isPersonalAccessToken,
  hashToken,
  normalizeScopes,
  generateTokenValue,
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
  authenticatePersonalAccessToken,
  tokenHasScope,
  formatTokenRow,
};
