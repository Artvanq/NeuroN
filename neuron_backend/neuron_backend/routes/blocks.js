const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { pickUserPublic } = require('../utils/serialize');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: req.user._id },
      include: { blocked: { include: { oauthAccounts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks.map((b) => pickUserPublic(b.blocked)));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, userId } = req.body;
    let target = null;
    if (userId) {
      target = await prisma.user.findUnique({ where: { id: String(userId) } });
    } else if (username) {
      target = await prisma.user.findUnique({
        where: { username: username.trim().toLowerCase() },
      });
    }
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (target.id === req.user._id) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: req.user._id, blockedId: target.id },
      },
      create: { blockerId: req.user._id, blockedId: target.id },
      update: {},
    });

    res.status(201).json({ message: 'User blocked', user: pickUserPublic(target) });
  })
);

router.delete(
  '/:userId',
  asyncHandler(async (req, res) => {
    await prisma.userBlock.deleteMany({
      where: { blockerId: req.user._id, blockedId: req.params.userId },
    });
    res.json({ message: 'User unblocked' });
  })
);

module.exports = router;
