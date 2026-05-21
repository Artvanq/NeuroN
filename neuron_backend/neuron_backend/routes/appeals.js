const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { attachUserIncludingBanned, requireAuthIncludingBanned } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');
const { verifyPassword } = require('../utils/authHelpers');
const { canModerate } = require('../utils/rbac');
const { formatSanction } = require('../utils/banSanction');

const router = express.Router();

const APPEAL_MIN_LEN = 20;
const APPEAL_MAX_LEN = 2000;
const APPEAL_WINDOW_DAYS = Number(process.env.BAN_APPEAL_WINDOW_DAYS || 7);
const APPEAL_MAX_PER_WINDOW = Number(process.env.BAN_APPEAL_MAX_PER_WINDOW || 3);

function formatAppeal(row) {
  if (!row) return null;
  return {
    _id: row.id,
    userId: row.userId,
    message: row.message,
    status: row.status,
    moderatorNote: row.moderatorNote || '',
    reviewedAt: row.reviewedAt || null,
    createdAt: row.createdAt,
    user: row.user
      ? {
          _id: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName,
        }
      : null,
    moderator: row.moderator
      ? {
          _id: row.moderator.id,
          username: row.moderator.username,
        }
      : null,
  };
}

async function resolveBannedUserFromCredentials(username, password) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized || !password) {
    return { error: 'Username and password are required' };
  }

  const row = await prisma.user.findUnique({ where: { username: normalized } });
  if (!row) return { error: 'Invalid username or password' };
  if (!row.passwordHash) {
    return { error: 'Password sign-in is not available for this account' };
  }
  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return { error: 'Invalid username or password' };
  if (!row.isBanned) return { error: 'This account is not banned' };
  return { user: row };
}

async function assertCanSubmitAppeal(userId) {
  const pending = await prisma.banAppeal.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) {
    return { ok: false, message: 'You already have a pending appeal' };
  }

  const since = new Date(Date.now() - APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.banAppeal.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recentCount >= APPEAL_MAX_PER_WINDOW) {
    return {
      ok: false,
      message: `Appeal limit reached (${APPEAL_MAX_PER_WINDOW} per ${APPEAL_WINDOW_DAYS} days)`,
    };
  }

  return { ok: true };
}

router.get(
  '/me',
  requireAuthIncludingBanned,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (!row) return res.status(404).json({ message: 'User not found' });

    const [pendingAppeal, recentAppeals] = await Promise.all([
      prisma.banAppeal.findFirst({
        where: { userId: row.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.banAppeal.findMany({
        where: { userId: row.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      sanction: formatSanction(row, { pendingAppeal }),
      appeals: recentAppeals.map(formatAppeal),
    });
  })
);

router.post(
  '/',
  authRateLimit,
  attachUserIncludingBanned,
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (message.length < APPEAL_MIN_LEN) {
      return res.status(400).json({
        message: `Appeal message must be at least ${APPEAL_MIN_LEN} characters`,
      });
    }
    if (message.length > APPEAL_MAX_LEN) {
      return res.status(400).json({ message: 'Appeal message is too long' });
    }

    let userRow = null;
    if (req.user?.isBanned) {
      userRow = await prisma.user.findUnique({ where: { id: req.user._id } });
    } else {
      const resolved = await resolveBannedUserFromCredentials(
        req.body?.username,
        req.body?.password
      );
      if (resolved.error) {
        const status = resolved.error.includes('not banned') ? 400 : 401;
        return res.status(status).json({ message: resolved.error });
      }
      userRow = resolved.user;
    }

    if (!userRow?.isBanned) {
      return res.status(400).json({ message: 'Only banned accounts can submit appeals' });
    }

    const gate = await assertCanSubmitAppeal(userRow.id);
    if (!gate.ok) {
      return res.status(409).json({ message: gate.message });
    }

    const appeal = await prisma.banAppeal.create({
      data: {
        userId: userRow.id,
        message: message.slice(0, APPEAL_MAX_LEN),
      },
    });

    res.status(201).json({ appeal: formatAppeal(appeal) });
  })
);

router.get(
  '/',
  requireAuthIncludingBanned,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const { status = 'pending', limit = '50', cursor } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const where = {};
    if (status !== 'all') {
      where.status = String(status).toUpperCase();
    }

    const rows = await prisma.banAppeal.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true, bannedReason: true, bannedAt: true } },
        moderator: { select: { id: true, username: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      take,
    });

    res.json({
      items: rows.map(formatAppeal),
      nextCursor: rows.length === take ? rows[rows.length - 1].id : null,
    });
  })
);

router.patch(
  '/:id',
  requireAuthIncludingBanned,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const decision = String(req.body?.status || '').toUpperCase();
    if (!['ACCEPTED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ message: 'status must be ACCEPTED or REJECTED' });
    }

    const note = String(req.body?.note || '').slice(0, 500);
    const existing = await prisma.banAppeal.findUnique({
      where: { id: String(req.params.id) },
      include: { user: true },
    });
    if (!existing) return res.status(404).json({ message: 'Appeal not found' });
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ message: 'Appeal was already reviewed' });
    }

    const reviewedAt = new Date();
    const appeal = await prisma.banAppeal.update({
      where: { id: existing.id },
      data: {
        status: decision,
        moderatorId: req.user._id,
        moderatorNote: note,
        reviewedAt,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        moderator: { select: { id: true, username: true } },
      },
    });

    if (decision === 'ACCEPTED') {
      await prisma.user.update({
        where: { id: existing.userId },
        data: {
          isBanned: false,
          bannedReason: '',
          bannedAt: null,
        },
      });
    }

    await prisma.moderationAction.create({
      data: {
        moderatorId: req.user._id,
        targetType: 'user',
        targetId: existing.userId,
        action: decision === 'ACCEPTED' ? 'appeal_accepted' : 'appeal_rejected',
        note,
        meta: { appealId: existing.id, priorBanReason: existing.user?.bannedReason || '' },
      },
    });

    res.json({ appeal: formatAppeal(appeal) });
  })
);

module.exports = router;
