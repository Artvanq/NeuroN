const prisma = require('./prisma');

function normalizeBranchName(name) {
  const raw = String(name || '').trim().toLowerCase();
  if (!raw || raw === 'main' && raw.length < 1) return null;
  if (!/^[a-z0-9][a-z0-9._/-]{0,62}$/.test(raw)) return null;
  if (raw.includes('..') || raw.startsWith('/') || raw.endsWith('/')) return null;
  return raw;
}

async function ensureBranch(projectId, branchName, { isDefault = false } = {}) {
  const name = normalizeBranchName(branchName) || 'main';
  await prisma.repoBranch.upsert({
    where: { projectId_name: { projectId, name } },
    create: { projectId, name },
    update: {},
  });
  if (isDefault) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultBranch: name },
    });
  }
  return name;
}

async function listBranches(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const rows = await prisma.repoBranch.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
  });
  if (rows.length === 0) {
    await ensureBranch(projectId, 'main', { isDefault: true });
    return [{ name: 'main', isDefault: true }];
  }
  return rows.map((b) => ({
    name: b.name,
    isDefault: b.name === (project?.defaultBranch || 'main'),
  }));
}

async function createBranch(projectId, name, fromBranch) {
  const branch = normalizeBranchName(name);
  if (!branch) throw Object.assign(new Error('Invalid branch name'), { status: 400 });

  const source = normalizeBranchName(fromBranch) || 'main';
  const exists = await prisma.repoBranch.findUnique({
    where: { projectId_name: { projectId, name: branch } },
  });
  if (exists) throw Object.assign(new Error('Branch already exists'), { status: 409 });

  const files = await prisma.repoFile.findMany({
    where: { projectId, branch: source },
  });

  if (files.length > 0) {
    await prisma.repoFile.createMany({
      data: files.map((f) => ({
        projectId,
        branch,
        path: f.path,
        content: f.content,
        updatedById: f.updatedById,
      })),
    });
  }

  await prisma.repoBranch.create({ data: { projectId, name: branch } });
  return branch;
}

function resolveBranch(project, queryBranch) {
  const normalized = normalizeBranchName(queryBranch);
  return normalized || project?.defaultBranch || 'main';
}

module.exports = {
  normalizeBranchName,
  ensureBranch,
  listBranches,
  createBranch,
  resolveBranch,
};
