const prisma = require('./prisma');
const { pickAuthor } = require('./serialize');

function formatCategoryModerator(row) {
  return {
    _id: row.id,
    user: pickAuthor(row.user),
    createdAt: row.createdAt,
  };
}

async function listCategoryModerators(categoryId) {
  const rows = await prisma.categoryModerator.findMany({
    where: { categoryId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(formatCategoryModerator);
}

async function addCategoryModerator(categoryId, username) {
  const user = await prisma.user.findUnique({
    where: { username: String(username).trim().toLowerCase() },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const row = await prisma.categoryModerator.upsert({
    where: { categoryId_userId: { categoryId, userId: user.id } },
    create: { categoryId, userId: user.id },
    update: {},
    include: { user: true },
  });
  return formatCategoryModerator(row);
}

async function removeCategoryModerator(categoryId, userId) {
  await prisma.categoryModerator.delete({
    where: { categoryId_userId: { categoryId, userId } },
  });
}

module.exports = {
  listCategoryModerators,
  addCategoryModerator,
  removeCategoryModerator,
  formatCategoryModerator,
};
