const crypto = require('crypto');
const prisma = require('./prisma');

function inviteRequired() {
  return process.env.INVITE_REQUIRED === 'true';
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

function generateInviteCode() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `NEURON-${raw}`;
}

async function countUsers() {
  return prisma.user.count();
}

async function findInvite(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return prisma.inviteCode.findUnique({ where: { code: normalized } });
}

async function validateInvite(code) {
  if (!inviteRequired()) {
    const userCount = await countUsers();
    if (userCount === 0) return { ok: true, bootstrap: true };
    if (!code) return { ok: true, optional: true };
  }

  if (!code) {
    return { ok: false, message: 'Invite code is required' };
  }

  const invite = await findInvite(code);
  if (!invite) {
    return { ok: false, message: 'Invalid invite code' };
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { ok: false, message: 'Invite code has expired' };
  }
  if (invite.usesCount >= invite.maxUses) {
    return { ok: false, message: 'Invite code has already been used' };
  }

  return { ok: true, invite };
}

async function redeemInvite(code, userId) {
  const check = await validateInvite(code);
  if (!check.ok) {
    const err = new Error(check.message);
    err.status = 400;
    throw err;
  }
  if (check.bootstrap || check.optional) return null;

  const invite = check.invite;
  const data = { usesCount: { increment: 1 } };
  if (invite.maxUses === 1) {
    data.redeemedById = userId;
  }

  await prisma.inviteCode.update({
    where: { id: invite.id },
    data,
  });

  return invite;
}

async function seedFounderInvites() {
  const raw = process.env.FOUNDER_INVITE_CODES || 'NEURON-FOUNDERS,NEURON-MINDS';
  const codes = raw
    .split(',')
    .map((c) => normalizeCode(c))
    .filter(Boolean);

  for (const code of codes) {
    const existing = await prisma.inviteCode.findUnique({ where: { code } });
    if (existing) continue;
    await prisma.inviteCode.create({
      data: {
        code,
        maxUses: 1000,
        usesCount: 0,
      },
    });
    console.log(`Founder invite seeded: ${code}`);
  }
}

async function createUserInvite(creatorId) {
  const user = await prisma.user.findUnique({ where: { id: creatorId } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.invitesRemaining <= 0) {
    const err = new Error('No invites remaining');
    err.status = 400;
    throw err;
  }

  const code = generateInviteCode();
  const [invite] = await prisma.$transaction([
    prisma.inviteCode.create({
      data: {
        code,
        createdById: creatorId,
        maxUses: 1,
      },
    }),
    prisma.user.update({
      where: { id: creatorId },
      data: { invitesRemaining: { decrement: 1 } },
    }),
  ]);

  return invite;
}

module.exports = {
  inviteRequired,
  normalizeCode,
  generateInviteCode,
  validateInvite,
  redeemInvite,
  seedFounderInvites,
  createUserInvite,
  findInvite,
};
