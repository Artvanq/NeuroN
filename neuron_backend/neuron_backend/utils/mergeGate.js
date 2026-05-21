const prisma = require('./prisma');

async function getBranchProtection(projectId, branchName) {
  const pattern = String(branchName || 'main').trim() || 'main';
  const row = await prisma.branchProtection.findUnique({
    where: {
      projectId_branchPattern: { projectId, branchPattern: pattern },
    },
  });
  if (row) return row;
  if (pattern === 'main') {
    return {
      requireCiSuccess: true,
      requireReview: true,
      requiredApprovalCount: 1,
    };
  }
  return null;
}

async function getLatestCiStatus(projectId, branch, pullNumber) {
  const triggerHint = pullNumber ? `pr:${pullNumber}` : null;
  const runs = await prisma.workflowRun.findMany({
    where: { projectId, branch },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  if (runs.length === 0) return { status: 'missing', run: null };

  const prRun = triggerHint
    ? runs.find((r) => String(r.trigger || '').includes(triggerHint))
    : null;
  const run = prRun || runs[0];
  return { status: run.status, run };
}

async function countApprovals(pullRequestId, authorId) {
  const reviews = await prisma.pullRequestReview.findMany({
    where: { pullRequestId },
    orderBy: { createdAt: 'asc' },
  });
  const latestByReviewer = new Map();
  for (const r of reviews) {
    latestByReviewer.set(r.reviewerId, r);
  }
  let approvals = 0;
  let changesRequested = false;
  for (const r of latestByReviewer.values()) {
    if (r.reviewerId === authorId) continue;
    if (r.state === 'APPROVED') approvals += 1;
    if (r.state === 'CHANGES_REQUESTED') changesRequested = true;
  }
  return { approvals, changesRequested };
}

async function evaluateMergeGate(projectId, pr) {
  const baseBranch = pr.baseBranch || 'main';
  const headBranch = pr.headBranch || '';

  const checks = {
    draft: { required: false, ok: true },
    ci: { required: false, ok: true, status: 'skipped' },
    reviews: { required: false, ok: true, approvals: 0, requiredCount: 0, changesRequested: false },
  };

  if (pr.isDraft) {
    checks.draft = { required: true, ok: false };
    return {
      ok: false,
      checks,
      message: 'Pull request is still a draft — mark it ready for review before merging',
      protection: null,
    };
  }

  const protection = await getBranchProtection(projectId, baseBranch);

  if (protection?.requireCiSuccess && headBranch) {
    checks.ci.required = true;
    const ci = await getLatestCiStatus(projectId, headBranch, pr.number);
    checks.ci.status = ci.status;
    checks.ci.ok = ci.status === 'success';
  }

  if (protection?.requireReview) {
    checks.reviews.required = true;
    checks.reviews.requiredCount = Math.max(1, protection.requiredApprovalCount || 1);
    const { approvals, changesRequested } = await countApprovals(pr.id, pr.authorId);
    checks.reviews.approvals = approvals;
    checks.reviews.changesRequested = changesRequested;
    checks.reviews.ok =
      !changesRequested && approvals >= checks.reviews.requiredCount;
  }

  const ok =
    checks.draft.ok &&
    (!checks.ci.required || checks.ci.ok) &&
    (!checks.reviews.required || checks.reviews.ok);

  let message = null;
  if (!ok) {
    if (checks.ci.required && !checks.ci.ok) {
      message =
        checks.ci.status === 'missing'
          ? 'CI has not run on the head branch yet'
          : `CI status is ${checks.ci.status}`;
    } else if (checks.reviews.required && !checks.reviews.ok) {
      if (checks.reviews.changesRequested) {
        message = 'Changes were requested — address feedback before merge';
      } else {
        message = `Need ${checks.reviews.requiredCount} approval(s), have ${checks.reviews.approvals}`;
      }
    } else {
      message = 'Merge requirements not met';
    }
  }

  return { ok, checks, message, protection };
}

module.exports = {
  getBranchProtection,
  evaluateMergeGate,
  countApprovals,
};
