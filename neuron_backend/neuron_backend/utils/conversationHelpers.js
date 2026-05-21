const prisma = require('./prisma');
const { wrapGroupKey, generateGroupKeyBase64, unwrapGroupKey } = require('./chatEncryption');
const { formatConversation } = require('./serialize');

const convInclude = {
  participants: true,
  members: { include: { user: true } },
  createdBy: true,
};

async function ensureGroupKey(conversationId, providedKeyBase64) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return null;
  if (conv.groupKeyEnc) {
    return providedKeyBase64 || unwrapGroupKey(conv.groupKeyEnc);
  }
  const raw = providedKeyBase64 || generateGroupKeyBase64();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { groupKeyEnc: wrapGroupKey(raw), keyVersion: { increment: 1 } },
  });
  return raw;
}

function formatConversationFull(row, viewerId) {
  if (!row) return null;
  const base = formatConversation(row);
  base.type = row.type;
  base.name = row.name;
  base.createdBy = row.createdBy
    ? {
        _id: row.createdBy.id,
        username: row.createdBy.username,
        displayName: row.createdBy.displayName,
      }
    : null;
  base.memberCount = row.participants?.length || 0;
  base.encrypted = Boolean(row.groupKeyEnc);
  base.members = (row.members || []).map((m) => ({
    _id: m.user.id,
    username: m.user.username,
    displayName: m.user.displayName,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  if (row.type === 'DM') {
    const other = row.participants?.find((p) => p.id !== viewerId);
    base.otherParticipant = other
      ? {
          _id: other.id,
          username: other.username,
          displayName: other.displayName,
        }
      : null;
    base.title = other?.displayName || other?.username || 'Dialogue';
  } else {
    base.title = row.name || 'Group';
  }

  return base;
}

async function isParticipant(conversationId, userId) {
  const count = await prisma.conversation.count({
    where: {
      id: conversationId,
      participants: { some: { id: userId } },
    },
  });
  return count > 0;
}

async function getMemberRole(conversationId, userId) {
  const m = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  return m?.role || null;
}

module.exports = {
  convInclude,
  ensureGroupKey,
  formatConversationFull,
  isParticipant,
  getMemberRole,
  unwrapGroupKey,
};
