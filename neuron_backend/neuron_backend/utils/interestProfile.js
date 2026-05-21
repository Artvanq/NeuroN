const prisma = require('./prisma');

function defaultProfile(categorySlugs = []) {
  return {
    tags: categorySlugs,
    interestVector: [],
    uiPrefs: { density: 'comfortable' },
    behavior: { clicks7d: {}, categoriesViewed: {} },
    consent: { recommendations: true, version: 1 },
    updatedAt: new Date().toISOString(),
  };
}

async function ensureInterestProfile(userId, { categorySlugs = [] } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { interestProfile: true },
  });
  if (!user) return null;

  const current = user.interestProfile;
  if (current && typeof current === 'object' && Object.keys(current).length > 0) {
    return current;
  }

  const profile = defaultProfile(categorySlugs);
  await prisma.user.update({
    where: { id: userId },
    data: { interestProfile: profile },
  });
  return profile;
}

async function updateInterestTags(userId, categorySlugs) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { interestProfile: true },
  });
  const base =
    user?.interestProfile && typeof user.interestProfile === 'object'
      ? user.interestProfile
      : defaultProfile(categorySlugs);

  await prisma.user.update({
    where: { id: userId },
    data: {
      interestProfile: {
        ...base,
        tags: categorySlugs,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

module.exports = {
  ensureInterestProfile,
  updateInterestTags,
};
