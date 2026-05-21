const prisma = require('../utils/prisma');
const { formatProject } = require('../utils/projectSerialize');
const { resolveProjectAccess } = require('../utils/projectAccess');

const projectInclude = {
  owner: true,
  category: true,
  _count: { select: { issues: true } },
};

async function searchProjects({ query, limit = 10, userId = null }) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const take = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const rows = await prisma.project.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: projectInclude,
    orderBy: { updatedAt: 'desc' },
    take,
  });

  const out = [];
  for (const p of rows) {
    const access = await resolveProjectAccess(userId, p);
    if (!access.read) continue;
    const [openIssueCount, openPullCount] = await Promise.all([
      prisma.issue.count({ where: { projectId: p.id, status: 'open' } }),
      prisma.pullRequest.count({ where: { projectId: p.id, status: 'open' } }),
    ]);
    const pathOwner = p.organization?.slug || p.owner?.username;
    out.push(formatProject({ ...p, openIssueCount, openPullCount }, pathOwner));
  }
  return out;
}

module.exports = {
  searchProjects,
};
