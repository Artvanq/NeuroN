const prisma = require('../utils/prisma');

const MAX_INQUIRIES_PER_THREAD = 5;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 280;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pickInquiry(row, extras = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    isSeed: Boolean(row.isSeed),
    threadCount: extras.threadCount ?? row._count?.threads,
    createdAt: row.createdAt,
  };
}

function normalizeSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function listInquiries({ q, limit = 100 } = {}) {
  const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const where = {};
  if (q && String(q).trim().length >= 2) {
    const text = String(q).trim();
    where.OR = [
      { name: { contains: text, mode: 'insensitive' } },
      { slug: { contains: text.toLowerCase(), mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.inquiry.findMany({
    where,
    include: { _count: { select: { threads: true } } },
    orderBy: [{ isSeed: 'desc' }, { name: 'asc' }],
    take: cap,
  });
  return rows.map((r) => pickInquiry(r));
}

async function findBySlug(slug) {
  const row = await prisma.inquiry.findUnique({
    where: { slug: normalizeSlug(slug) },
    include: { _count: { select: { threads: true } } },
  });
  return row ? pickInquiry(row) : null;
}

async function ensureInquiriesBySlug(slugs, { creatorId } = {}) {
  const normalized = Array.from(
    new Set(slugs.map(normalizeSlug).filter((s) => SLUG_RE.test(s)))
  ).slice(0, MAX_INQUIRIES_PER_THREAD);
  if (normalized.length === 0) return [];

  const existing = await prisma.inquiry.findMany({
    where: { slug: { in: normalized } },
  });
  const haveSlugs = new Set(existing.map((e) => e.slug));
  const toCreate = normalized.filter((s) => !haveSlugs.has(s));

  if (toCreate.length > 0) {
    await prisma.inquiry.createMany({
      data: toCreate.map((slug) => ({
        slug,
        name: slug
          .split('-')
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' '),
        createdById: creatorId ? String(creatorId) : null,
        isSeed: false,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.inquiry.findMany({ where: { slug: { in: normalized } } });
}

async function setThreadInquiries(threadId, slugs, { creatorId } = {}) {
  const rows = await ensureInquiriesBySlug(slugs, { creatorId });
  const ids = rows.map((r) => r.id);

  await prisma.$transaction([
    prisma.threadInquiry.deleteMany({ where: { threadId: String(threadId) } }),
    ...(ids.length
      ? [
          prisma.threadInquiry.createMany({
            data: ids.map((inquiryId) => ({ threadId: String(threadId), inquiryId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return rows.map((r) => pickInquiry(r));
}

async function listThreadInquiries(threadId) {
  const rows = await prisma.threadInquiry.findMany({
    where: { threadId: String(threadId) },
    include: { inquiry: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => pickInquiry(r.inquiry));
}

module.exports = {
  listInquiries,
  findBySlug,
  setThreadInquiries,
  listThreadInquiries,
  ensureInquiriesBySlug,
  normalizeSlug,
  pickInquiry,
  MAX_INQUIRIES_PER_THREAD,
  MAX_NAME,
  MAX_DESCRIPTION,
  SLUG_RE,
};
