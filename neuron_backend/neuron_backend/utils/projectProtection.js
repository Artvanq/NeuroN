const prisma = require('./prisma');

async function ensureDefaultBranchProtection(projectId, defaultBranch = 'main') {
  const pattern = String(defaultBranch || 'main').trim() || 'main';
  await prisma.branchProtection.upsert({
    where: {
      projectId_branchPattern: { projectId, branchPattern: pattern },
    },
    create: {
      projectId,
      branchPattern: pattern,
      requireCiSuccess: true,
      requireReview: true,
      requiredApprovalCount: 1,
    },
    update: {},
  });
}

function formatBranchProtection(row) {
  if (!row) return null;
  return {
    branchPattern: row.branchPattern,
    requireCiSuccess: row.requireCiSuccess,
    requireReview: row.requireReview,
    requiredApprovalCount: row.requiredApprovalCount,
  };
}

module.exports = {
  ensureDefaultBranchProtection,
  formatBranchProtection,
};
