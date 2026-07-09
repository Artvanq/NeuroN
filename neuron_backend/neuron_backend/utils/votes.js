const prisma = require('./prisma');
const { createNotification } = require('./notify');
const { notifyVoteAuthor } = require('./voteNotify');

const MAX_REPLY_DEPTH = 8;

async function getScore(targetType, targetId) {
  if (targetType === 'thread') {
    const row = await prisma.thread.findUnique({
      where: { id: String(targetId) },
      select: { score: true },
    });
    return row?.score ?? 0;
  }
  const row = await prisma.reply.findUnique({
    where: { id: String(targetId) },
    select: { score: true },
  });
  return row?.score ?? 0;
}

async function castVote(userId, targetType, targetId, requestedValue) {
  const tid = String(targetId);
  const type = String(targetType);
  if (!['thread', 'reply'].includes(type)) {
    throw Object.assign(new Error('Invalid target type'), { status: 400 });
  }

  let authorId;
  if (type === 'thread') {
    const thread = await prisma.thread.findUnique({ where: { id: tid }, select: { authorId: true } });
    if (!thread) throw Object.assign(new Error('Thread not found'), { status: 404 });
    authorId = thread.authorId;
  } else {
    const reply = await prisma.reply.findUnique({ where: { id: tid }, select: { authorId: true } });
    if (!reply) throw Object.assign(new Error('Reply not found'), { status: 404 });
    authorId = reply.authorId;
  }

  if (authorId && String(authorId) === String(userId) && requestedValue) {
    throw Object.assign(new Error('You cannot vote on your own post'), { status: 400 });
  }

  // Wrap the read-check-write in a transaction so concurrent votes from the
  // same user (double-click, retry) can't both read "no existing vote" and
  // race each other into a duplicate-key error / lost score increment.
  const { myVote, scoreDelta } = await prisma.$transaction(async (tx) => {
    const existing = await tx.vote.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: String(userId),
          targetType: type,
          targetId: tid,
        },
      },
    });

    let nextVote = null;
    let delta = 0;

    if (requestedValue === 0 || requestedValue === null || requestedValue === undefined) {
      if (existing) {
        delta = -existing.value;
        await tx.vote.delete({ where: { id: existing.id } });
      }
    } else {
      const v = requestedValue > 0 ? 1 : -1;
      if (!existing) {
        nextVote = v;
        delta = v;
        await tx.vote.create({
          data: { userId: String(userId), targetType: type, targetId: tid, value: v },
        });
      } else if (existing.value === v) {
        delta = -v;
        await tx.vote.delete({ where: { id: existing.id } });
      } else {
        nextVote = v;
        delta = v - existing.value;
        await tx.vote.update({ where: { id: existing.id }, data: { value: v } });
      }
    }

    if (delta !== 0) {
      if (type === 'thread') {
        await tx.thread.update({ where: { id: tid }, data: { score: { increment: delta } } });
      } else {
        await tx.reply.update({ where: { id: tid }, data: { score: { increment: delta } } });
      }
    }

    return { myVote: nextVote, scoreDelta: delta };
  });

  const score = await getScore(type, tid);

  if (scoreDelta > 0 && myVote === 1) {
    notifyVoteAuthor({ voterId: userId, targetType: type, targetId: tid, scoreDelta }).catch(
      () => {}
    );
  }

  return { score, myVote };
}

async function attachMyVotes(items, targetType, userId) {
  if (!userId || items.length === 0) return items;
  const ids = items.map((i) => i._id || i.id);
  const votes = await prisma.vote.findMany({
    where: {
      userId: String(userId),
      targetType,
      targetId: { in: ids.map(String) },
    },
  });
  const map = Object.fromEntries(votes.map((v) => [v.targetId, v.value]));
  return items.map((item) => ({
    ...item,
    myVote: map[item._id] ?? null,
  }));
}

async function getReplyDepth(replyId) {
  let depth = 0;
  let current = replyId;
  while (current && depth < MAX_REPLY_DEPTH) {
    const row = await prisma.reply.findUnique({
      where: { id: String(current) },
      select: { parentReplyId: true },
    });
    if (!row?.parentReplyId) return depth;
    depth += 1;
    current = row.parentReplyId;
  }
  return depth;
}

function hotRank(score, createdAt) {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  return score / Math.pow(Math.max(hours, 0) + 2, 1.5);
}

module.exports = {
  castVote,
  attachMyVotes,
  getReplyDepth,
  hotRank,
  MAX_REPLY_DEPTH,
};
