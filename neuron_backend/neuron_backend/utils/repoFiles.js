const prisma = require('./prisma');
const { normalizeRepoPath } = require('./repoPath');
const { ensureBranch } = require('./repoBranch');
const { recordRepoFileRevision } = require('./repoRevisions');

const DEFAULT_CI = `name: CI
on:
  - push
  - pull_request
jobs:
  test:
    steps:
      - run: echo "Neuron CI — add npm test when your project is ready"
`;

async function seedReadmeFromProject(project) {
  await ensureBranch(project.id, 'main', { isDefault: true });

  if (project.readme?.trim()) {
    const path = 'README.md';
    const existing = await prisma.repoFile.findUnique({
      where: {
        projectId_branch_path: { projectId: project.id, branch: 'main', path },
      },
    });
    if (!existing) {
      await prisma.repoFile.create({
        data: {
          projectId: project.id,
          branch: 'main',
          path,
          content: project.readme.trim(),
          updatedById: project.ownerId,
        },
      });
    }
  }

  const ciPath = '.neuron/ci.yml';
  const ciExists = await prisma.repoFile.findUnique({
    where: {
      projectId_branch_path: { projectId: project.id, branch: 'main', path: ciPath },
    },
  });
  if (!ciExists) {
    await prisma.repoFile.create({
      data: {
        projectId: project.id,
        branch: 'main',
        path: ciPath,
        content: DEFAULT_CI,
        updatedById: project.ownerId,
      },
    });
  }
}

async function applyChangesToBranch(projectId, branch, changes, userId) {
  const branchName = (await ensureBranch(projectId, branch)) || 'main';

  for (const change of changes) {
    const path = normalizeRepoPath(change.path);
    if (!path) continue;

    if (change.action === 'delete') {
      await prisma.repoFile.deleteMany({
        where: { projectId, branch: branchName, path },
      });
    } else {
      const content = String(change.content || '');
      await prisma.repoFile.upsert({
        where: {
          projectId_branch_path: { projectId, branch: branchName, path },
        },
        create: {
          projectId,
          branch: branchName,
          path,
          content,
          updatedById: userId,
        },
        update: {
          content,
          updatedById: userId,
        },
      });
      await recordRepoFileRevision({
        projectId,
        branch: branchName,
        path,
        content,
        authorId: userId,
      });
    }
  }

  if (branchName === 'main') {
    const readmeFile = await prisma.repoFile.findUnique({
      where: {
        projectId_branch_path: { projectId, branch: 'main', path: 'README.md' },
      },
    });
    if (readmeFile) {
      await prisma.project.update({
        where: { id: projectId },
        data: { readme: readmeFile.content.slice(0, 32000) },
      });
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  return branchName;
}

async function applyChangesToMain(projectId, changes, userId) {
  return applyChangesToBranch(projectId, 'main', changes, userId);
}

async function getBranchFiles(projectId, branch) {
  return prisma.repoFile.findMany({
    where: { projectId, branch },
    orderBy: { path: 'asc' },
  });
}

module.exports = {
  seedReadmeFromProject,
  applyChangesToMain,
  applyChangesToBranch,
  getBranchFiles,
  DEFAULT_CI,
};
