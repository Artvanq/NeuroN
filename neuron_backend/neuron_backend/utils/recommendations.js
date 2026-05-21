const prisma = require('./prisma');
const { pickUserPublic } = require('./serialize');
const { findThreadsPaginated } = require('./threadPaginate');

function profileTags(profile) {
  if (!profile || typeof profile !== 'object') return [];
  const tags = profile.tags;
  return Array.isArray(tags) ? tags.map(String).filter(Boolean) : [];
}

function tagOverlap(a, b) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

async function findCompatibleMinds(viewerId, { limit = 8 } = {}) {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    include: { interestedCategories: true },
  });
  if (!viewer) return [];

  const myTags = [
    ...viewer.interestedCategories.map((c) => c.slug),
    ...profileTags(viewer.interestProfile),
  ];
  const uniqueTags = [...new Set(myTags)];
  if (uniqueTags.length === 0) return [];

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      OR: [
        { interestedCategories: { some: { slug: { in: uniqueTags } } } },
      ],
    },
    include: { interestedCategories: true },
    take: 40,
    orderBy: { createdAt: 'desc' },
  });

  const ranked = candidates
    .map((row) => {
      const theirTags = [
        ...row.interestedCategories.map((c) => c.slug),
        ...profileTags(row.interestProfile),
      ];
      const shared = tagOverlap(uniqueTags, theirTags);
      return { row, shared };
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.row.createdAt - a.row.createdAt)
    .slice(0, Math.min(limit, 20));

  return ranked.map(({ row, shared }) => ({
    ...pickUserPublic(row),
    sharedFields: shared,
  }));
}

async function findRecommendedThreads(viewerId, { limit = 12, cursor } = {}) {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    include: { interestedCategories: true },
  });
  if (!viewer) {
    return { threads: [], nextCursor: null };
  }

  const slugs = viewer.interestedCategories.map((c) => c.slug).filter(Boolean);
  if (slugs.length === 0) {
    return { threads: [], nextCursor: null };
  }

  const cats = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  if (cats.length === 0) {
    return { threads: [], nextCursor: null };
  }

  return findThreadsPaginated(
    { category: { $in: cats.map((c) => c.id) } },
    {
      sort: 'hot',
      limit,
      cursor,
      viewerUserId: viewerId,
    }
  );
}

module.exports = {
  findCompatibleMinds,
  findRecommendedThreads,
  profileTags,
};
