const prisma = require('../utils/prisma');
const { pickAuthor, pickCategory } = require('../utils/serialize');
const { canManageCategory, isCategoryModerator } = require('../utils/categoryAccess');
const { createUserCategory } = require('../utils/categoryCreate');

async function listCategories() {
  const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return rows.map((r) => pickCategory(r));
}

async function findCategoryBySlug(slug, viewerUser) {
  const row = await prisma.category.findUnique({
    where: { slug: String(slug).trim().toLowerCase() },
    include: {
      createdBy: true,
      _count: { select: { moderators: true } },
    },
  });
  if (!row) return null;
  const viewerId = viewerUser?._id;
  const extras = {
    createdBy: row.createdBy ? pickAuthor(row.createdBy) : null,
    isUserCommunity: Boolean(row.createdById),
    moderatorCount: row._count?.moderators,
    isCategoryModerator: viewerId ? await isCategoryModerator(viewerId, row.id) : false,
    canManageCategory: viewerUser ? await canManageCategory(viewerUser, row.id) : false,
  };
  return pickCategory(row, extras);
}

async function listUserCreatedCategories(userId) {
  const rows = await prisma.category.findMany({
    where: { createdById: String(userId) },
    include: { createdBy: true, _count: { select: { moderators: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) =>
    pickCategory(row, {
      createdBy: row.createdBy ? pickAuthor(row.createdBy) : null,
      isUserCommunity: true,
      moderatorCount: row._count?.moderators,
      isCategoryModerator: true,
      canManageCategory: true,
    })
  );
}

async function findCategoryById(id) {
  const row = await prisma.category.findUnique({ where: { id: String(id) } });
  return row ? pickCategory(row) : null;
}

async function findCategoriesBySlugs(slugs) {
  const normalized = slugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return [];
  const rows = await prisma.category.findMany({
    where: { slug: { in: normalized } },
    orderBy: { name: 'asc' },
  });
  return rows.map(pickCategory);
}

async function findFirstCategory() {
  const rows = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    take: 1,
  });
  return rows[0] ? pickCategory(rows[0]) : null;
}

async function countCategories() {
  return prisma.category.count();
}

async function listExistingSlugs() {
  const rows = await prisma.category.findMany({ select: { slug: true } });
  return new Set(rows.map((r) => r.slug));
}

async function countCategoriesByIds(ids) {
  const list = ids.map(String).filter(Boolean);
  if (list.length === 0) return 0;
  return prisma.category.count({ where: { id: { in: list } } });
}

async function insertCategories(items) {
  if (!items?.length) return;
  await prisma.category.createMany({
    data: items.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description || '',
      icon: c.icon || '',
      color: c.color || '#6366f1',
    })),
    skipDuplicates: true,
  });
}

module.exports = {
  listCategories,
  findCategoryBySlug,
  findCategoryById,
  findCategoriesBySlugs,
  findFirstCategory,
  countCategories,
  countCategoriesByIds,
  listExistingSlugs,
  insertCategories,
  createUserCategory,
  listUserCreatedCategories,
};
