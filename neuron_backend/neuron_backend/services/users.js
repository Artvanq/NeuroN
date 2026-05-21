const prisma = require('../utils/prisma');
const { pickUserAuth, sameId } = require('../utils/serialize');

const AUTH_INCLUDE = {
  interestedCategories: true,
  oauthAccounts: true,
};

function toAuthUser(row) {
  if (!row) return null;
  const user = {
    ...pickUserAuth(row),
    _id: row.id,
    passwordHash: row.passwordHash,
    isBanned: Boolean(row.isBanned),
    bannedReason: row.bannedReason || '',
    bannedAt: row.bannedAt || null,
    platformRole: row.platformRole || 'MEMBER',
    oauthAccounts: row.oauthAccounts || [],
    interestedCategories: row.interestedCategories || [],
    equals(other) {
      return sameId(row.id, other);
    },
  };
  return user;
}

async function getUserById(userId) {
  const row = await prisma.user.findUnique({
    where: { id: String(userId) },
    include: AUTH_INCLUDE,
  });
  return toAuthUser(row);
}

async function findUserByUsername(username) {
  const row = await prisma.user.findUnique({
    where: { username: String(username).trim().toLowerCase() },
    include: AUTH_INCLUDE,
  });
  return toAuthUser(row);
}

async function findUserIdByUsername(username) {
  const row = await prisma.user.findUnique({
    where: { username: String(username).trim().toLowerCase() },
    select: { id: true },
  });
  return row?.id || null;
}

async function createUser(data) {
  const row = await prisma.user.create({
    data: {
      username: data.username,
      displayName: data.displayName,
      passwordHash: data.passwordHash || null,
      avatarUrl: data.avatarUrl || null,
      profileUrl: data.profileUrl || null,
      mindStatement: data.mindStatement || '',
      onboardingCompleted: data.onboardingCompleted || false,
    },
    include: AUTH_INCLUDE,
  });
  return toAuthUser(row);
}

async function countUsers() {
  return prisma.user.count();
}

async function searchUsers({ query, limit = 20 }) {
  const q = String(query || '').trim();
  if (!q) return [];
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { mindStatement: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: Math.min(Math.max(Number(limit) || 20, 1), 50),
    select: {
      id: true,
      username: true,
      displayName: true,
      mindStatement: true,
    },
  });
  return rows.map((r) => ({
    _id: r.id,
    username: r.username,
    displayName: r.displayName,
    mindStatement: r.mindStatement,
  }));
}

async function searchUsersByUsername({ query, limit = 20 }) {
  const q = String(query || '').trim();
  if (!q) return [];
  const rows = await prisma.user.findMany({
    where: { username: { contains: q, mode: 'insensitive' } },
    take: Math.min(Math.max(Number(limit) || 20, 1), 50),
    select: { id: true, username: true, displayName: true },
  });
  return rows.map((r) => ({
    _id: r.id,
    username: r.username,
    displayName: r.displayName,
  }));
}

async function getSocketUser(userId) {
  const row = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, username: true, displayName: true, isBanned: true },
  });
  if (!row || row.isBanned) return null;
  return { _id: row.id, username: row.username, displayName: row.displayName };
}

module.exports = {
  getUserById,
  findUserByUsername,
  findUserIdByUsername,
  createUser,
  countUsers,
  searchUsers,
  searchUsersByUsername,
  getSocketUser,
};
