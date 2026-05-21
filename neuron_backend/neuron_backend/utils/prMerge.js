const prisma = require('./prisma');
const { normalizeRepoPath } = require('./repoPath');
const { ensureBranch, normalizeBranchName } = require('./repoBranch');

const MERGE_METHODS = ['merge', 'squash', 'rebase'];

function normalizeMergeMethod(raw) {
  const method = String(raw || 'merge')
    .trim()
    .toLowerCase();
  return MERGE_METHODS.includes(method) ? method : 'merge';
}

async function refreshPullChangesFromBase(projectId, changes, baseBranch) {
  const branchName = (await ensureBranch(projectId, baseBranch)) || 'main';
  const refreshed = [];

  for (const change of changes) {
    const path = normalizeRepoPath(change.path);
    if (!path) continue;

    const existing = await prisma.repoFile.findUnique({
      where: {
        projectId_branch_path: { projectId, branch: branchName, path },
      },
    });

    refreshed.push({
      path,
      action: change.action,
      content: change.content,
      oldContent: existing?.content ?? change.oldContent ?? '',
    });
  }

  return refreshed;
}

async function deleteProjectBranch(projectId, branchName) {
  const name = normalizeBranchName(branchName);
  if (!name || name === 'main') return;

  await prisma.repoFile.deleteMany({
    where: { projectId, branch: name },
  });
  await prisma.repoBranch.deleteMany({
    where: { projectId, name },
  });
}

async function cleanupAfterMerge(projectId, pr, mergeMethod) {
  const base = normalizeBranchName(pr.baseBranch) || 'main';
  const head = normalizeBranchName(pr.headBranch);
  if (!head || head === base) return { deletedHeadBranch: null };

  if (mergeMethod === 'squash' || mergeMethod === 'rebase') {
    await deleteProjectBranch(projectId, head);
    return { deletedHeadBranch: head };
  }

  return { deletedHeadBranch: null };
}

module.exports = {
  MERGE_METHODS,
  normalizeMergeMethod,
  refreshPullChangesFromBase,
  deleteProjectBranch,
  cleanupAfterMerge,
};
