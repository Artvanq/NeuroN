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

// Collects replyId plus every descendant reply id at any depth (not just
// direct children) via BFS, so deep threads (MAX_REPLY_DEPTH up to 8) don't
// leave orphaned grandchildren behind with parentReplyId nulled out by
// onDelete: SetNull.
async function collectReplySubtreeIds(replyId) {
  const allIds = [String(replyId)];
  let frontier = [String(replyId)];

  while (frontier.length) {
    const children = await prisma.reply.findMany({
      where: { parentReplyId: { in: frontier } },
      select: { id: true },
    });
    if (!children.length) break;
    frontier = children.map((c) => String(c.id));
    allIds.push(...frontier);
  }

  return allIds;
}

// Deletes the given set of reply ids (expected to be a full subtree from
// collectReplySubtreeIds) and returns how many rows were actually removed,
// so callers can keep denormalized counters (e.g. thread.replyCount) exact
// rather than guessing based on direct-child count.
async function deleteReplySubtree(ids) {
  const result = await prisma.reply.deleteMany({ where: { id: { in: ids.map(String) } } });
  return result.count;
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
  collectReplySubtreeIds,
  deleteReplySubtree,
  deleteAllRepliesForThread,
};
