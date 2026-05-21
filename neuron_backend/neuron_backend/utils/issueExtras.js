const { pickAuthor } = require('./serialize');

function normalizeMilestoneTitle(title) {
  return String(title || '')
    .trim()
    .slice(0, 120);
}

function formatProjectMilestone(row) {
  if (!row) return null;
  return {
    _id: row.id,
    title: row.title,
    description: row.description || '',
    state: row.state,
    dueAt: row.dueAt,
    openIssueCount: row.openIssueCount,
    createdAt: row.createdAt,
  };
}

function formatIssueAssignees(rows) {
  return (rows || [])
    .map((row) => pickAuthor(row.user))
    .filter(Boolean);
}

async function syncIssueAssignees(prisma, { issueId, projectId, assigneeIds }) {
  const ids = [...new Set((assigneeIds || []).map(String).filter(Boolean))];
  if (ids.length) {
    const collabs = await prisma.projectCollaborator.findMany({
      where: { projectId: String(projectId), userId: { in: ids } },
      select: { userId: true },
    });
    const project = await prisma.project.findUnique({
      where: { id: String(projectId) },
      select: { ownerId: true, organizationId: true },
    });
    const allowed = new Set(ids.filter((id) => id === project?.ownerId));
    collabs.forEach((c) => allowed.add(c.userId));
    if (project?.organizationId) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId: project.organizationId, userId: { in: ids } },
        select: { userId: true },
      });
      orgMembers.forEach((m) => allowed.add(m.userId));
    }
    if (allowed.size !== ids.length) {
      const err = new Error('Assignees must be project owner or collaborators');
      err.status = 400;
      throw err;
    }
  }
  await prisma.issueAssignee.deleteMany({ where: { issueId: String(issueId) } });
  if (ids.length) {
    await prisma.issueAssignee.createMany({
      data: ids.map((userId) => ({ issueId: String(issueId), userId })),
      skipDuplicates: true,
    });
  }
}

async function resolveMilestoneId(prisma, { projectId, milestoneId }) {
  if (milestoneId === undefined) return undefined;
  if (milestoneId === null || milestoneId === '') return null;
  const row = await prisma.projectMilestone.findFirst({
    where: { id: String(milestoneId), projectId: String(projectId) },
  });
  if (!row) {
    const err = new Error('Milestone not found for this project');
    err.status = 400;
    throw err;
  }
  return row.id;
}

module.exports = {
  normalizeMilestoneTitle,
  formatProjectMilestone,
  formatIssueAssignees,
  syncIssueAssignees,
  resolveMilestoneId,
};
