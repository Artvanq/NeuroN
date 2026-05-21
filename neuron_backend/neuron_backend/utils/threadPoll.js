const prisma = require('./prisma');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MAX_LABEL_LEN = 120;

function normalizePollOptions(raw) {
  if (!Array.isArray(raw)) return { ok: false, message: 'Poll options must be an array' };
  const labels = raw
    .map((o) => String(o || '').trim())
    .filter(Boolean)
    .map((label) => label.slice(0, MAX_LABEL_LEN));
  const unique = [...new Set(labels.map((l) => l.toLowerCase()))];
  if (labels.length < MIN_OPTIONS) {
    return { ok: false, message: `Poll needs at least ${MIN_OPTIONS} options` };
  }
  if (labels.length > MAX_OPTIONS) {
    return { ok: false, message: `Poll allows at most ${MAX_OPTIONS} options` };
  }
  if (unique.length !== labels.length) {
    return { ok: false, message: 'Poll options must be unique' };
  }
  return { ok: true, labels };
}

function parsePollEndsAt(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid poll end date' };
  if (d.getTime() <= Date.now()) return { error: 'Poll end must be in the future' };
  return d;
}

function isPollClosed(poll) {
  if (!poll?.endsAt) return false;
  return new Date(poll.endsAt).getTime() <= Date.now();
}

function formatPoll(pollRow, { viewerUserId } = {}) {
  if (!pollRow) return null;
  const options = (pollRow.options || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((opt) => {
      const voteCount = opt._count?.votes ?? (opt.votes?.length || 0);
      return {
        _id: opt.id,
        label: opt.label,
        voteCount,
      };
    });
  const totalVotes = options.reduce((sum, o) => sum + o.voteCount, 0);
  let myOptionId = null;
  if (viewerUserId && pollRow.votes?.length) {
    const mine = pollRow.votes.find((v) => String(v.userId) === String(viewerUserId));
    myOptionId = mine?.optionId || null;
  }
  return {
    _id: pollRow.id,
    endsAt: pollRow.endsAt || null,
    closed: isPollClosed(pollRow),
    options,
    totalVotes,
    myOptionId,
  };
}

async function createPollForThread(threadId, { options, endsAt }) {
  const normalized = normalizePollOptions(options);
  if (!normalized.ok) {
    const err = new Error(normalized.message);
    err.status = 400;
    throw err;
  }
  const ends = parsePollEndsAt(endsAt);
  if (ends && ends.error) {
    const err = new Error(ends.error);
    err.status = 400;
    throw err;
  }

  const poll = await prisma.threadPoll.create({
    data: {
      threadId: String(threadId),
      endsAt: ends || null,
      options: {
        create: normalized.labels.map((label, position) => ({ label, position })),
      },
    },
    include: {
      options: { include: { _count: { select: { votes: true } } } },
      votes: true,
    },
  });
  return formatPoll(poll);
}

async function loadPollForThread(threadId, viewerUserId) {
  const poll = await prisma.threadPoll.findUnique({
    where: { threadId: String(threadId) },
    include: {
      options: {
        orderBy: { position: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      votes: viewerUserId
        ? { where: { userId: String(viewerUserId) }, select: { optionId: true, userId: true } }
        : false,
    },
  });
  return formatPoll(poll, { viewerUserId });
}

async function voteOnThreadPoll(threadId, { optionId, userId }) {
  const poll = await prisma.threadPoll.findUnique({
    where: { threadId: String(threadId) },
    include: { options: { select: { id: true } } },
  });
  if (!poll) {
    const err = new Error('This thread has no poll');
    err.status = 404;
    throw err;
  }
  if (isPollClosed(poll)) {
    const err = new Error('Poll is closed');
    err.status = 400;
    throw err;
  }
  const validOption = poll.options.some((o) => String(o.id) === String(optionId));
  if (!validOption) {
    const err = new Error('Invalid poll option');
    err.status = 400;
    throw err;
  }

  await prisma.threadPollVote.upsert({
    where: {
      pollId_userId: {
        pollId: poll.id,
        userId: String(userId),
      },
    },
    create: {
      pollId: poll.id,
      optionId: String(optionId),
      userId: String(userId),
    },
    update: { optionId: String(optionId) },
  });

  return loadPollForThread(threadId, userId);
}

module.exports = {
  MIN_OPTIONS,
  MAX_OPTIONS,
  normalizePollOptions,
  parsePollEndsAt,
  isPollClosed,
  formatPoll,
  createPollForThread,
  loadPollForThread,
  voteOnThreadPoll,
};
