const prisma = require('./prisma');
const { createNotification } = require('./notify');

async function notifyCiResult(projectId, branch, status, workflowName) {
  const project = await prisma.project.findUnique({
    where: { id: String(projectId) },
    select: { ownerId: true, slug: true, owner: { select: { username: true } } },
  });
  if (!project) return;

  const type = status === 'success' ? 'project_ci_success' : 'project_ci_failure';
  const title = status === 'success' ? 'CI passed' : 'CI failed';
  const link = `/p/${project.owner.username}/${project.slug}/actions`;

  await createNotification({
    userId: project.ownerId,
    type,
    title,
    body: `${workflowName || 'Workflow'} on ${branch}: ${status}`,
    link,
  });
}

module.exports = { notifyCiResult };
