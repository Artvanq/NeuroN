const crypto = require('crypto');
const prisma = require('./prisma');
const { normalizePublicKeyLine, fingerprintKeyData } = require('./gitSshCommand');

const MAX_KEYS_PER_USER = 10;

function formatSshKeyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    fingerprint: row.fingerprint,
    publicKey: row.publicKey,
    createdAt: row.createdAt,
  };
}

async function listSshPublicKeys(userId) {
  const rows = await prisma.sshPublicKey.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(formatSshKeyRow);
}

async function addSshPublicKey(userId, { label, publicKey }) {
  const cleanLabel = String(label || '').trim().slice(0, 80);
  if (!cleanLabel) {
    throw Object.assign(new Error('Key label is required'), { status: 400 });
  }

  const parsed = normalizePublicKeyLine(publicKey);
  if (!parsed) {
    throw Object.assign(new Error('Invalid SSH public key format'), { status: 400 });
  }

  const count = await prisma.sshPublicKey.count({ where: { userId: String(userId) } });
  if (count >= MAX_KEYS_PER_USER) {
    throw Object.assign(new Error(`Maximum ${MAX_KEYS_PER_USER} SSH keys per account`), { status: 400 });
  }

  const fingerprint = fingerprintKeyData(parsed.keyData);
  const existing = await prisma.sshPublicKey.findUnique({ where: { fingerprint } });
  if (existing) {
    throw Object.assign(new Error('This SSH key is already registered'), { status: 409 });
  }

  const row = await prisma.sshPublicKey.create({
    data: {
      userId: String(userId),
      label: cleanLabel,
      publicKey: parsed.opensshLine,
      fingerprint,
    },
  });

  return formatSshKeyRow(row);
}

async function deleteSshPublicKey(userId, keyId) {
  const row = await prisma.sshPublicKey.findFirst({
    where: { id: String(keyId), userId: String(userId) },
  });
  if (!row) {
    throw Object.assign(new Error('SSH key not found'), { status: 404 });
  }
  await prisma.sshPublicKey.delete({ where: { id: row.id } });
  return { message: 'SSH key removed' };
}

async function findUserBySshPublicKey(keyData) {
  if (!keyData || !keyData.length) return null;
  const fingerprint = fingerprintKeyData(keyData);
  const row = await prisma.sshPublicKey.findUnique({
    where: { fingerprint },
    include: { user: { include: { oauthAccounts: true, interestedCategories: true } } },
  });
  if (!row?.user) return null;
  if (row.user.isBanned) return null;

  const userService = require('../services/users');
  return userService.getUserById(row.user.id);
}

module.exports = {
  listSshPublicKeys,
  addSshPublicKey,
  deleteSshPublicKey,
  findUserBySshPublicKey,
  fingerprintKeyData,
};
