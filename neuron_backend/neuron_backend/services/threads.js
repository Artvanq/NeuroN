const prisma = require('../utils/prisma');
const { formatThread, sameId } = require('../utils/serialize');
const { buildWhere } = require('../utils/threadPaginate');
const { loadPollForThread } = require('../utils/threadPoll');
const { CROSSPOST_INCLUDE } = require('../utils/threadCrosspost');

const THREAD_INCLUDE = {
  author: true,
  category: true,
  crosspostOf: { include: { author: true, category: true } },
  poll: { select: { id: true } },
  inquiries: { include: { inquiry: true } },
};

function attachThreadHelpers(thread) {
  if (!thread) return null;
  return {
    ...thread,
    equals(other) {
      return sameId(thread._id, other);
    },
  };
}

async function getThreadById(threadId, { includeMind = false, viewerUserId } = {}) {
  const row = await prisma.thread.findUnique({
    where: { id: String(threadId) },
    include: CROSSPOST_INCLUDE,
  });
  if (!row) return null;
  const poll = row.poll?.id ? await loadPollForThread(row.id, viewerUserId) : null;
  return attachThreadHelpers(formatThread(row, { includeMind, poll }));
}

async function listRelatedThreads({ threadId, categoryId, limit = 6 }) {
  const rows = await prisma.thread.findMany({
    where: {
      id: { not: String(threadId) },
      categoryId: String(categoryId),
    },
    include: THREAD_INCLUDE,
    orderBy: [{ replyCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  return rows.map((r) => formatThread(r));
}

async function listThreads(filter = {}, { sort, limit } = {}) {
  const where = buildWhere(filter);
  let orderBy = [{ createdAt: 'desc' }];
  if (sort?.replyCount === -1) {
    orderBy = [{ replyCount: 'desc' }, { createdAt: 'desc' }];
  }

  const rows = await prisma.thread.findMany({
    where,
    include: THREAD_INCLUDE,
    orderBy,
    take: limit || undefined,
  });
  return rows.map((r) => formatThread(r));
}

async function createThread({ title, body, authorId, categoryId, attachments, crosspostOfThreadId }) {
  const row = await prisma.thread.create({
    data: {
      title,
      body: body || '',
      attachments: attachments || [],
      authorId: String(authorId),
      categoryId: String(categoryId),
      crosspostOfThreadId: crosspostOfThreadId ? String(crosspostOfThreadId) : null,
    },
    include: CROSSPOST_INCLUDE,
  });
  const poll = row.poll?.id ? await loadPollForThread(row.id) : null;
  return formatThread(row, { poll });
}

async function updateThread(threadId, { title, body, replyCount }) {
  const data = {};
  if (title !== undefined) data.title = title;
  if (body !== undefined) data.body = body;
  if (replyCount !== undefined) data.replyCount = replyCount;

  const row = await prisma.thread.update({
    where: { id: String(threadId) },
    data,
    include: THREAD_INCLUDE,
  });
  return attachThreadHelpers(formatThread(row));
}

async function incrementThreadReplyCount(threadId, delta) {
  const row = await prisma.thread.update({
    where: { id: String(threadId) },
    data: { replyCount: { increment: delta } },
    include: THREAD_INCLUDE,
  });
  return attachThreadHelpers(formatThread(row));
}

async function setThreadReplyCount(threadId, replyCount) {
  const row = await prisma.thread.update({
    where: { id: String(threadId) },
    data: { replyCount: Math.max(0, Number(replyCount) || 0) },
    include: THREAD_INCLUDE,
  });
  return attachThreadHelpers(formatThread(row));
}

async function deleteThread(threadId) {
  await prisma.thread.delete({ where: { id: String(threadId) } });
}

module.exports = {
  getThreadById,
  listRelatedThreads,
  listThreads,
  createThread,
  updateThread,
  incrementThreadReplyCount,
  setThreadReplyCount,
  deleteThread,
};
