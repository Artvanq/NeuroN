const prisma = require('./prisma');
const { formatThread } = require('./serialize');

const THREAD_INCLUDE = { author: true, category: true };

async function searchThreadsFts(query, { limit = 20 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const take = Math.min(Math.max(Number(limit) || 20, 1), 40);
  const rows = await prisma.$queryRaw`
    SELECT t.id
    FROM threads t
    WHERE to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.body, ''))
      @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank(
      to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.body, '')),
      plainto_tsquery('english', ${q})
    ) DESC,
    t.created_at DESC
    LIMIT ${take}
  `;

  const ids = rows.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  const threads = await prisma.thread.findMany({
    where: { id: { in: ids } },
    include: THREAD_INCLUDE,
  });
  const byId = new Map(threads.map((t) => [t.id, t]));
  return ids.map((id) => formatThread(byId.get(id))).filter(Boolean);
}

module.exports = { searchThreadsFts };
