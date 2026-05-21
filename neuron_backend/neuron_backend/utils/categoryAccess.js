const prisma = require('./prisma');
const { canModerate, isSiteAdmin } = require('./rbac');

async function isCategoryModerator(userId, categoryId) {
  if (!userId || !categoryId) return false;
  const row = await prisma.categoryModerator.findUnique({
    where: {
      categoryId_userId: { categoryId: String(categoryId), userId: String(userId) },
    },
  });
  return Boolean(row);
}

async function canManageCategory(user, categoryId) {
  if (!user?._id) return false;
  if (isSiteAdmin(user) || canModerate(user)) return true;
  return isCategoryModerator(user._id, categoryId);
}

async function canEditCategoryRules(user, categoryId) {
  return canManageCategory(user, categoryId);
}

module.exports = {
  isCategoryModerator,
  canManageCategory,
  canEditCategoryRules,
};
