const { pickAuthor, pickCategory } = require('./serialize');
const { formatIssueLabels } = require('./issueLabels');
const { formatProjectMilestone, formatIssueAssignees } = require('./issueExtras');
const { formatPullRequestReviewComment } = require('./prReviewComments');
const { diffLines } = require('./diffLines');

function formatProject(p, ownerUsername, extras = {}) {
  if (!p) return null;
  return {
    _id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    readme: p.readme,
    owner: p.owner
      ? pickAuthor(p.owner)
      : ownerUsername
        ? { username: ownerUsername }
        : null,
    ownerUsername: ownerUsername || p.organization?.slug || p.owner?.username,
    organizationSlug: p.organization?.slug || null,
    forkedFromId: p.forkedFromId || null,
    category: pickCategory(p.category),
    issueCount: p._count?.issues,
    openIssueCount: p.openIssueCount,
    openPullCount: p.openPullCount,
    defaultBranch: p.defaultBranch || 'main',
    fileCount: p._count?.repoFiles,
    visibility: p.visibility || 'PUBLIC',
    starCount: extras.starCount ?? p.starCount,
    watchCount: extras.watchCount ?? p.watchCount,
    viewerStarred: extras.viewerStarred ?? false,
    viewerWatching: extras.viewerWatching ?? false,
    viewerRole: extras.viewerRole,
    viewerPermissions: extras.viewerPermissions,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function formatRepoFile(f) {
  if (!f) return null;
  return {
    _id: f.id,
    branch: f.branch,
    path: f.path,
    content: f.content,
    updatedAt: f.updatedAt,
    updatedBy: f.updatedBy ? pickAuthor(f.updatedBy) : null,
  };
}

function formatWorkflowRun(r) {
  if (!r) return null;
  return {
    _id: r.id,
    branch: r.branch,
    workflowName: r.workflowName,
    trigger: r.trigger,
    status: r.status,
    logs: r.logs,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  };
}

function formatPullRequestChange(c) {
  return {
    _id: c.id,
    path: c.path,
    action: c.action,
    content: c.content,
    oldContent: c.oldContent,
    diff: diffLines(c.oldContent, c.action === 'delete' ? '' : c.content),
  };
}

function formatPullRequestReview(r) {
  if (!r) return null;
  return {
    _id: r.id,
    state: r.state,
    body: r.body,
    reviewer: pickAuthor(r.reviewer),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function formatPullRequest(pr, extras = {}) {
  if (!pr) return null;
  return {
    _id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    status: pr.status,
    isDraft: Boolean(pr.isDraft),
    baseBranch: pr.baseBranch || 'main',
    headBranch: pr.headBranch || '',
    author: pickAuthor(pr.author),
    changes: (pr.changes || []).map(formatPullRequestChange),
    reviews: (pr.reviews || []).map(formatPullRequestReview),
    reviewComments: (pr.reviewComments || []).map((c) =>
      formatPullRequestReviewComment(c, {
        canEdit: extras.viewerId && c.authorId === extras.viewerId,
        canDelete:
          (extras.viewerId && c.authorId === extras.viewerId) || extras.canModerateComments === true,
      })
    ),
    mergeMethod: extras.mergeMethod,
    deletedHeadBranch: extras.deletedHeadBranch,
    mergeable: extras.mergeable,
    mergeChecks: extras.mergeChecks,
    viewerRole: extras.viewerRole,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    mergedAt: pr.mergedAt,
  };
}

function formatIssue(i, extras = {}) {
  if (!i) return null;
  const commentCount =
    extras.commentCount !== undefined
      ? extras.commentCount
      : i._count?.comments !== undefined
        ? i._count.comments
        : undefined;
  return {
    _id: i.id,
    number: i.number,
    title: i.title,
    body: i.body,
    status: i.status,
    author: pickAuthor(i.author),
    threadId: i.threadId,
    labels: formatIssueLabels(i.labels),
    milestone: i.milestone ? formatProjectMilestone(i.milestone) : null,
    assignees: formatIssueAssignees(i.assignees),
    commentCount,
    project: i.project ? formatProject(i.project) : null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

module.exports = {
  formatProject,
  formatIssue,
  formatRepoFile,
  formatPullRequest,
  formatPullRequestReview,
  formatPullRequestReviewComment,
  formatWorkflowRun,
  slugify,
};
