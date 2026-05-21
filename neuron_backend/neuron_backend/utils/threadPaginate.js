const prisma = require('./prisma');
const { formatThread } = require('./serialize');
const { attachMyVotes, hotRank } = require('./votes');

const threadInclude = {
  author: true,
  category: true,
  crosspostOf: { include: { author: true, category: true } },
  poll: { select: { id: true } },
  inquiries: { include: { inquiry: true } },
};

const HOT_WINDOW_DAYS = 14;

function buildWhere(filter) {
  const where = {};
  if (filter.category) {
    if (filter.category.$in) {
      where.categoryId = { in: filter.category.$in.map(String) };
    } else {
      where.categoryId = String(filter.category);
    }
  }
  if (filter.inquiry) {
    where.inquiries = { some: { inquiryId: String(filter.inquiry) } };
  }
  if (filter.inquirySlug) {
    where.inquiries = {
      some: { inquiry: { slug: String(filter.inquirySlug).toLowerCase() } },
    };
  }
  if (filter.author) where.authorId = String(filter.author);
  if (filter._id?.$ne) where.id = { not: String(filter._id.$ne) };
  if (filter.replyCount?.$lt !== undefined) {
    where.replyCount = { lt: filter.replyCount.$lt };
  }
  if (filter.replyCount?.$gte !== undefined) {
    where.replyCount = { gte: filter.replyCount.$gte };
  }
  if (filter.$or) {
    const q = filter.$or[0]?.title?.$regex?.source;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }
  }
  if (filter.q) {
    const text = String(filter.q).trim();
    if (text.length >= 2) {
      const textFilter = {
        OR: [
          { title: { contains: text, mode: 'insensitive' } },
          { body: { contains: text, mode: 'insensitive' } },
        ],
      };
      where.AND = [...(where.AND || []), textFilter];
    }
  }
  return where;
}

function normalizeSortMode(sort) {
  const s = String(sort || 'hot').toLowerCase();
  if (s === 'new' || s === 'top' || s === 'hot') return s;
  if (s === 'recent') return 'new';
  return 'hot';
}

function buildOrder(sortMode) {
  const pinnedFirst = { isPinned: 'desc' };
  if (sortMode === 'top') {
    return [pinnedFirst, { score: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
  }
  return [pinnedFirst, { createdAt: 'desc' }, { id: 'desc' }];
}

function cursorFilter(cursorRow, sortMode) {
  if (!cursorRow) return null;
  if (sortMode === 'top') {
    return {
      OR: [
        { score: { lt: cursorRow.score } },
        {
          score: cursorRow.score,
          createdAt: { lt: cursorRow.createdAt },
        },
        {
          score: cursorRow.score,
          createdAt: cursorRow.createdAt,
          id: { lt: cursorRow.id },
        },
      ],
    };
  }
  return {
    OR: [
      { createdAt: { lt: cursorRow.createdAt } },
      { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
    ],
  };
}

async function findThreadsPaginated(filter, { sort, limit = 20, cursor, viewerUserId } = {}) {
  const sortMode = normalizeSortMode(sort);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const where = buildWhere(filter);

  if (sortMode === 'hot') {
    const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: since };
  }

  if (cursor && sortMode !== 'hot') {
    const cursorRow = await prisma.thread.findUnique({ where: { id: String(cursor) } });
    const cursorWhere = cursorFilter(cursorRow, sortMode);
    if (cursorWhere) {
      where.AND = [...(where.AND || []), cursorWhere];
    }
  }

  let rows;
  if (sortMode === 'hot') {
    const fetchSize = Math.min(pageSize * 4, 120);
    rows = await prisma.thread.findMany({
      where,
      include: threadInclude,
      orderBy: [{ isPinned: 'desc' }, { score: 'desc' }, { createdAt: 'desc' }],
      take: fetchSize,
    });
    rows = rows
      .map((r) => ({ row: r, rank: hotRank(r.score, r.createdAt) }))
      .sort((a, b) => b.rank - a.rank || b.row.createdAt - a.row.createdAt)
      .map((x) => x.row);

    if (cursor) {
      const cursorIdx = rows.findIndex((r) => r.id === String(cursor));
      if (cursorIdx >= 0) rows = rows.slice(cursorIdx + 1);
    }

    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    let items = slice.map((r) => formatThread(r));
    if (viewerUserId) items = await attachMyVotes(items, 'thread', viewerUserId);
    const nextCursor = hasMore ? slice[slice.length - 1].id : null;
    return { threads: items, nextCursor };
  }

  rows = await prisma.thread.findMany({
    where,
    include: threadInclude,
    orderBy: buildOrder(sortMode),
    take: pageSize + 1,
  });

  const hasMore = rows.length > pageSize;
  const slice = hasMore ? rows.slice(0, pageSize) : rows;
  let items = slice.map((r) => formatThread(r));
  if (viewerUserId) items = await attachMyVotes(items, 'thread', viewerUserId);
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  return { threads: items, nextCursor };
}

module.exports = { findThreadsPaginated, buildWhere, normalizeSortMode };
