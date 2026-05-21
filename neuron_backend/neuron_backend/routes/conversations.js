const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { emitChatMessage } = require('../socket');
const { createNotification } = require('../utils/notify');
const { formatMessage, formatMessageReaction } = require('../utils/serialize');
const { normalizeAttachments } = require('../utils/attachments');
const { isEncryptedPayload } = require('../utils/chatEncryption');
const {
  convInclude,
  ensureGroupKey,
  formatConversationFull,
  isParticipant,
  getMemberRole,
  unwrapGroupKey,
} = require('../utils/conversationHelpers');
const { canMessageUser } = require('../utils/privacy');

const router = express.Router();

router.use(requireAuth);

async function enrichList(conversations, viewerId) {
  const convIds = conversations.map((c) => c.id);
  const lastByConv = {};

  if (convIds.length > 0) {
    const latest = await prisma.message.findMany({
      where: { conversationId: { in: convIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['conversationId'],
      include: { sender: true },
    });
    for (const m of latest) {
      lastByConv[m.conversationId] = formatMessage(m);
    }
  }

  return conversations.map((c) => ({
    ...formatConversationFull(c, viewerId),
    lastMessage: lastByConv[c.id] || null,
  }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { id: req.user._id } } },
      include: convInclude,
      orderBy: { lastMessageAt: 'desc' },
    });
    res.json(await enrichList(conversations, req.user._id));
  })
);

router.post(
  '/groups',
  asyncHandler(async (req, res) => {
    const { name, memberUsernames = [], groupKey } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    if (!Array.isArray(memberUsernames)) {
      return res.status(400).json({ message: 'memberUsernames must be an array' });
    }

    const usernames = [...new Set(memberUsernames.map((u) => u.trim().toLowerCase()))].filter(
      Boolean
    );
    const users = await prisma.user.findMany({
      where: { username: { in: usernames } },
    });
    if (users.length !== usernames.length) {
      return res.status(400).json({ message: 'One or more usernames not found' });
    }

    const participantIds = [...new Set([req.user._id, ...users.map((u) => u.id)])];

    const conversation = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        name: name.trim().slice(0, 80),
        createdById: req.user._id,
        participants: { connect: participantIds.map((id) => ({ id })) },
        members: {
          create: participantIds.map((id) => ({
            userId: id,
            role: id === req.user._id ? 'owner' : 'member',
          })),
        },
      },
      include: convInclude,
    });

    await ensureGroupKey(conversation.id, groupKey);

    const refreshed = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: convInclude,
    });

    res.status(201).json(formatConversationFull(refreshed, req.user._id));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, userId } = req.body;
    let otherUser = null;

    if (userId) {
      otherUser = await prisma.user.findUnique({ where: { id: userId } });
    } else if (username) {
      otherUser = await prisma.user.findUnique({
        where: { username: username.trim().toLowerCase() },
      });
    }

    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (otherUser.id === req.user._id) {
      return res.status(400).json({ message: 'Cannot message yourself' });
    }

    const messageAccess = await canMessageUser(req.user._id, otherUser);
    if (!messageAccess.ok) {
      return res.status(403).json({
        message: messageAccess.message,
        code: messageAccess.code,
      });
    }

    const existing = await prisma.conversation.findMany({
      where: {
        type: 'DM',
        AND: [
          { participants: { some: { id: req.user._id } } },
          { participants: { some: { id: otherUser.id } } },
        ],
      },
      include: convInclude,
    });
    const dm = existing.find((c) => c.participants.length === 2);
    if (dm) {
      await ensureGroupKey(dm.id);
      return res.json(formatConversationFull(dm, req.user._id));
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: 'DM',
        createdById: req.user._id,
        participants: { connect: [{ id: req.user._id }, { id: otherUser.id }] },
        members: {
          create: [
            { userId: req.user._id, role: 'member' },
            { userId: otherUser.id, role: 'member' },
          ],
        },
      },
      include: convInclude,
    });

    await ensureGroupKey(conversation.id, req.body.groupKey);

    res.status(201).json(formatConversationFull(conversation, req.user._id));
  })
);

router.get(
  '/:id/crypto-key',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const raw = await ensureGroupKey(req.params.id);
    res.json({ groupKey: raw, keyVersion: 1 });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: convInclude,
    });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (!(await isParticipant(conversation.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(formatConversationFull(conversation, req.user._id));
  })
);

router.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { usernames = [] } = req.body;
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: convInclude,
    });
    if (!conversation || conversation.type !== 'GROUP') {
      return res.status(404).json({ message: 'Group not found' });
    }

    const role = await getMemberRole(conversation.id, req.user._id);
    if (!['owner', 'admin'].includes(role)) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    const names = [...new Set(usernames.map((u) => u.trim().toLowerCase()))].filter(Boolean);
    const users = await prisma.user.findMany({ where: { username: { in: names } } });
    const existingIds = new Set(conversation.participants.map((p) => p.id));
    const toAdd = users.filter((u) => !existingIds.has(u.id));

    for (const u of toAdd) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          participants: { connect: { id: u.id } },
          members: { create: { userId: u.id, role: 'member' } },
        },
      });
    }

    const refreshed = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: convInclude,
    });
    res.json(formatConversationFull(refreshed, req.user._id));
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: true, reactions: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    res.json(messages.map(formatMessage));
  })
);

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { participants: true },
    });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (!(await isParticipant(conversation.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { body, attachments } = req.body;
    if (!body?.trim() && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'Message body or attachment is required' });
    }

    const encrypted = isEncryptedPayload(body);

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user._id,
        body: String(body || '').trim(),
        attachments: normalizeAttachments(attachments),
        encrypted,
      },
      include: { sender: true, reactions: { include: { user: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const payload = formatMessage(message);
    payload.toObject = () => ({ ...payload });

    const io = req.app.get('io');
    if (io) {
      emitChatMessage(io, String(conversation.id), payload);
    }

    const title =
      conversation.type === 'GROUP'
        ? `New message in ${conversation.name || 'group'}`
        : 'New dialogue message';

    const notifyBody = encrypted
      ? 'Encrypted message'
      : body.trim().slice(0, 120);

    for (const p of conversation.participants) {
      if (p.id === req.user._id) continue;
      await createNotification({
        userId: p.id,
        type: 'message',
        title,
        body: notifyBody,
        link: `/messages/${conversation.id}`,
        actorId: req.user._id,
      });
    }

    res.status(201).json(payload);
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const lastReadMessageId = req.body.messageId ? String(req.body.messageId) : null;
    const state = await prisma.conversationReadState.upsert({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user._id },
      },
      create: {
        conversationId: req.params.id,
        userId: req.user._id,
        lastReadAt: new Date(),
        lastReadMessageId,
      },
      update: {
        lastReadAt: new Date(),
        lastReadMessageId,
      },
    });
    res.json({
      lastReadAt: state.lastReadAt,
      lastReadMessageId: state.lastReadMessageId,
    });
  })
);

router.patch(
  '/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.conversationId !== req.params.id) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (message.senderId !== req.user._id) {
      return res.status(403).json({ message: 'Only the sender can edit' });
    }
    if (message.deletedAt) {
      return res.status(400).json({ message: 'Message was deleted' });
    }
    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'Edit window expired' });
    }
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ message: 'body is required' });

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { body, editedAt: new Date() },
      include: { sender: true, reactions: { include: { user: true } } },
    });
    const payload = formatMessage(updated);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.params.id}`).emit('chat_message_updated', payload);
    res.json(payload);
  })
);

router.delete(
  '/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.conversationId !== req.params.id) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (message.senderId !== req.user._id) {
      return res.status(403).json({ message: 'Only the sender can delete' });
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: '' },
      include: { sender: true, reactions: { include: { user: true } } },
    });
    const payload = formatMessage(updated);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.params.id}`).emit('chat_message_updated', payload);
    res.json(payload);
  })
);

router.post(
  '/:id/messages/:messageId/reactions',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.conversationId !== req.params.id || message.deletedAt) {
      return res.status(404).json({ message: 'Message not found' });
    }
    const emoji = String(req.body.emoji || '👍').trim().slice(0, 16) || '👍';

    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId: message.id,
          userId: req.user._id,
          emoji,
        },
      },
      create: { messageId: message.id, userId: req.user._id, emoji },
      update: {},
      include: { user: true },
    });

    const payload = formatMessageReaction(reaction);
    const io = req.app.get('io');
    if (io) io.to(`conversation:${req.params.id}`).emit('chat_reaction', { messageId: message.id, reaction: payload });
    res.status(201).json(payload);
  })
);

router.delete(
  '/:id/messages/:messageId/reactions',
  asyncHandler(async (req, res) => {
    if (!(await isParticipant(req.params.id, req.user._id))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const emoji = String(req.query.emoji || req.body?.emoji || '👍').trim().slice(0, 16) || '👍';
    await prisma.messageReaction.deleteMany({
      where: {
        messageId: req.params.messageId,
        userId: req.user._id,
        emoji,
      },
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${req.params.id}`).emit('chat_reaction_removed', {
        messageId: req.params.messageId,
        userId: req.user._id,
        emoji,
      });
    }
    res.json({ message: 'Removed' });
  })
);

module.exports = router;
