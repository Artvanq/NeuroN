const prisma = require('./prisma');

function normalizeTemplateName(name) {
  return String(name || '')
    .trim()
    .slice(0, 48);
}

function formatIssueTemplate(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    title: row.title,
    body: row.body || '',
    createdAt: row.createdAt,
  };
}

async function getProjectEngagement(projectId, userId) {
  const pid = String(projectId);
  const [starCount, watchCount, starRow, watchRow] = await Promise.all([
    prisma.projectStar.count({ where: { projectId: pid } }),
    prisma.projectWatch.count({ where: { projectId: pid } }),
    userId
      ? prisma.projectStar.findUnique({
          where: { userId_projectId: { userId: String(userId), projectId: pid } },
        })
      : Promise.resolve(null),
    userId
      ? prisma.projectWatch.findUnique({
          where: { userId_projectId: { userId: String(userId), projectId: pid } },
        })
      : Promise.resolve(null),
  ]);
  return {
    starCount,
    watchCount,
    viewerStarred: Boolean(starRow),
    viewerWatching: Boolean(watchRow),
  };
}

module.exports = {
  normalizeTemplateName,
  formatIssueTemplate,
  getProjectEngagement,
};
