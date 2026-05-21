const { pickAuthor } = require('./serialize');

const MAX_BODY = 32000;

function normalizeIssueCommentBody(body) {
  return String(body || '').trim().slice(0, MAX_BODY);
}

function formatIssueComment(row) {
  if (!row) return null;
  const deleted = Boolean(row.deletedAt);
  return {
    _id: row.id,
    body: deleted ? '' : row.body,
    author: pickAuthor(row.author),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt || null,
    canEdit: row.canEdit === true,
    canDelete: row.canDelete === true,
  };
}

async function notifyIssueCommentRecipients({
  prisma,
  createNotification,
  issue,
  project,
  pathOwner,
  number,
  commenterId,
  commenterUsername,
  commentId,
}) {
  const assigneeRows = await prisma.issueAssignee.findMany({
    where: { issueId: issue.id },
    select: { userId: true },
  });
  const watchers = await prisma.projectWatch.findMany({
    where: { projectId: project.id },
    select: { userId: true },
  });

  const recipients = new Set();
  if (issue.authorId !== commenterId) recipients.add(issue.authorId);
  if (project.ownerId !== commenterId) recipients.add(project.ownerId);
  for (const row of assigneeRows) {
    if (row.userId !== commenterId) recipients.add(row.userId);
  }
  for (const row of watchers) {
    if (row.userId !== commenterId) recipients.add(row.userId);
  }

  const link = `/p/${pathOwner}/${project.slug}/issues/${number}#comment-${commentId}`;
  const title = `Comment on #${number}`;
  const body = `${commenterUsername} commented on ${issue.title}`;

  await Promise.all(
    [...recipients].map((userId) =>
      createNotification({
        userId,
        type: 'project_issue_comment',
        title,
        body,
        link,
        actorId: commenterId,
      })
    )
  );
}

module.exports = {
  MAX_BODY,
  normalizeIssueCommentBody,
  formatIssueComment,
  notifyIssueCommentRecipients,
};
