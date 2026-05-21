const prisma = require('../utils/prisma');
const { formatReply, sameId } = require('../utils/serialize');

const REPLY_INCLUDE = { author: true };

async function listRepliesForThread(threadId, { order = 'asc' } = {}) {
  const rows = await prisma.reply.findMany({
    where: { threadId: String(threadId) },
    include: REPLY_INCLUDE,
    orderBy: { createdAt: order === 'desc' ? 'desc' : 'asc' },
  });
  return rows.map(formatReply);
}

async function findReplyInThread({ replyId, threadId }) {
  const row = await prisma.reply.findFirst({
    where: { id: String(replyId), threadId: String(threadId) },
    include: REPLY_INCLUDE,
  });
  if (!row) return null;
  const reply = formatReply(row);
  reply.equals = (other) => sameId(reply._id, other);
  return reply;
}

async function createReply({ threadId, body, authorId, parentReplyId }) {
  const row = await prisma.reply.create({
    data: {
      threadId: String(threadId),
      body,
      authorId: String(authorId),
      parentReplyId: parentReplyId ? String(parentReplyId) : null,
    },
    include: REPLY_INCLUDE,
  });
  const reply = formatReply(row);
  reply.equals = (other) => sameId(reply._id, other);
  return reply;
}

async function updateReplyBody(replyId, body) {
  const row = await prisma.reply.update({
    where: { id: String(replyId) },
    data: { body },
    include: REPLY_INCLUDE,
  });
  const reply = formatReply(row);
  reply.equals = (other) => sameId(reply._id, other);
  return reply;
}

async function userRepliedOnThread({ threadId, authorId }) {
  const count = await prisma.reply.count({
    where: { threadId: String(threadId), authorId: String(authorId) },
  });
  return count > 0;
}

async function deleteReplySubtree({ replyId, childReplyIds = [] }) {
  const ids = [String(replyId), ...childReplyIds.map(String)].filter(Boolean);
  await prisma.reply.deleteMany({
    where: {
      OR: [{ id: { in: ids } }, { parentReplyId: { in: ids } }],
    },
  });
}

async function deleteAllRepliesForThread(threadId) {
  await prisma.reply.deleteMany({ where: { threadId: String(threadId) } });
}

module.exports = {
  listRepliesForThread,
  findReplyInThread,
  createReply,
  updateReplyBody,
  userRepliedOnThread,
  deleteReplySubtree,
  deleteAllRepliesForThread,
};
