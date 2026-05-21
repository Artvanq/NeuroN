const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { pickUserPublic } = require('../utils/serialize');
const { canMessageUser, getBlockStatus } = require('../utils/privacy');
const { createNotification } = require('../utils/notify');
const { ensureGroupKey, formatConversationFull, convInclude } = require('../utils/conversationHelpers');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/incoming',
  asyncHandler(async (req, res) => {
    const rows = await prisma.messageRequest.findMany({
      where: { toUserId: req.user._id, status: 'PENDING' },
      include: { fromUser: { include: { oauthAccounts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      rows.map((r) => ({
        _id: r.id,
        body: r.body,
        status: r.status,
        createdAt: r.createdAt,
        fromUser: pickUserPublic(r.fromUser),
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, body } = req.body;
    if (!username?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'username and body are required' });
    }

    const target = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    const access = await canMessageUser(req.user._id, target);
    if (access.ok) {
      return res.status(400).json({ message: 'You can message this user directly' });
    }
    if (access.code !== 'request_required' && access.code !== 'request_pending') {
      return res.status(403).json({ message: access.message });
    }
    if (access.code === 'request_pending') {
      return res.status(409).json({ message: access.message });
    }
    if (target.profileVisibility !== 'REQUEST') {
      return res.status(403).json({ message: 'This user does not accept message requests' });
    }

    const request = await prisma.messageRequest.upsert({
      where: {
        fromUserId_toUserId: { fromUserId: req.user._id, toUserId: target.id },
      },
      create: {
        fromUserId: req.user._id,
        toUserId: target.id,
        body: body.trim().slice(0, 500),
        status: 'PENDING',
      },
      update: {
        body: body.trim().slice(0, 500),
        status: 'PENDING',
        respondedAt: null,
      },
    });

    await createNotification({
      userId: target.id,
      type: 'message_request',
      title: 'Message request',
      body: `${req.user.username} wants to start a dialogue`,
      link: '/settings#requests',
      actorId: req.user._id,
    });

    res.status(201).json({
      _id: request.id,
      status: request.status,
      message: 'Request sent',
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ message: 'status must be ACCEPTED or DECLINED' });
    }

    const request = await prisma.messageRequest.findUnique({
      where: { id: req.params.id },
      include: { fromUser: true, toUser: true },
    });
    if (!request || request.toUserId !== req.user._id) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request already handled' });
    }

    const { blocked, blockedBy } = await getBlockStatus(req.user._id, request.fromUserId);
    if (blocked || blockedBy) {
      return res.status(403).json({ message: 'Cannot respond — block in effect' });
    }

    let conversation = null;

    if (status === 'ACCEPTED') {
      const existing = await prisma.conversation.findMany({
        where: {
          type: 'DM',
          AND: [
            { participants: { some: { id: req.user._id } } },
            { participants: { some: { id: request.fromUserId } } },
          ],
        },
        include: convInclude,
      });
      const dm = existing.find((c) => c.participants.length === 2);

      if (dm) {
        conversation = dm;
      } else {
        conversation = await prisma.conversation.create({
          data: {
            type: 'DM',
            createdById: req.user._id,
            participants: {
              connect: [{ id: req.user._id }, { id: request.fromUserId }],
            },
            members: {
              create: [
                { userId: req.user._id, role: 'member' },
                { userId: request.fromUserId, role: 'member' },
              ],
            },
          },
          include: convInclude,
        });
        await ensureGroupKey(conversation.id);
      }

      await createNotification({
        userId: request.fromUserId,
        type: 'message_request_accepted',
        title: 'Request accepted',
        body: `${req.user.username} accepted your dialogue request`,
        link: conversation ? `/messages/${conversation.id}` : '/messages',
        actorId: req.user._id,
      });
    } else if (status === 'DECLINED') {
      await createNotification({
        userId: request.fromUserId,
        type: 'message_request_declined',
        title: 'Request declined',
        body: `${req.user.username} declined your dialogue request`,
        link: '/settings',
        actorId: req.user._id,
      });
    }

    const updated = await prisma.messageRequest.update({
      where: { id: request.id },
      data: { status, respondedAt: new Date() },
    });

    res.json({
      _id: updated.id,
      status: updated.status,
      conversation: conversation
        ? formatConversationFull(conversation, req.user._id)
        : null,
    });
  })
);

module.exports = router;
