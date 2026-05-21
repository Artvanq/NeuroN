const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const {
  formatProject,
  formatIssue,
  formatRepoFile,
  formatPullRequest,
  formatWorkflowRun,
  slugify,
} = require('../utils/projectSerialize');
const { normalizeRepoPath, buildFileTree } = require('../utils/repoPath');
const {
  seedReadmeFromProject,
  applyChangesToBranch,
} = require('../utils/repoFiles');
const {
  resolveBranch,
  listBranches,
  createBranch,
  normalizeBranchName,
} = require('../utils/repoBranch');
const { triggerCi, runWorkflow } = require('../utils/ciRunner');
const { sendProjectArchive } = require('../utils/repoArchive');
const { createNotification } = require('../utils/notify');
const {
  resolveProjectAccess,
  requireProjectPermission,
  requireProjectRead,
} = require('../utils/projectAccess');
const { evaluateMergeGate } = require('../utils/mergeGate');
const {
  ensureDefaultBranchProtection,
  formatBranchProtection,
} = require('../utils/projectProtection');
const {
  listCollaborators,
  addCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
} = require('../utils/projectCollaborators');
const { formatPullRequestReview } = require('../utils/projectSerialize');
const categoryService = require('../services/categories');
const threadService = require('../services/threads');
const { findProjectByPath, projectInclude, resolveOwnerNamespace } = require('../utils/projectLookup');
const { requireOrgRole } = require('../utils/orgAccess');
const {
  normalizeLabelName,
  normalizeLabelColor,
  formatProjectLabel,
  syncIssueLabels,
} = require('../utils/issueLabels');
const {
  normalizeMilestoneTitle,
  formatProjectMilestone,
  syncIssueAssignees,
  resolveMilestoneId,
} = require('../utils/issueExtras');
const {
  normalizeTemplateName,
  formatIssueTemplate,
  getProjectEngagement,
} = require('../utils/projectEngagement');
const {
  normalizeIssueCommentBody,
  formatIssueComment,
  notifyIssueCommentRecipients,
} = require('../utils/issueComments');
const {
  normalizeMergeMethod,
  refreshPullChangesFromBase,
  cleanupAfterMerge,
} = require('../utils/prMerge');
const {
  normalizeReviewSide,
  formatPullRequestReviewComment,
  validateInlineComment,
} = require('../utils/prReviewComments');
const {
  recordRepoFileRevision,
  formatRepoFileRevision,
  computeBlameLines,
} = require('../utils/repoRevisions');

const issueInclude = {
  author: true,
  labels: { include: { label: true } },
  milestone: true,
  assignees: { include: { user: true } },
};

const pullRequestDetailInclude = {
  author: true,
  changes: true,
  reviews: { include: { reviewer: true }, orderBy: { createdAt: 'desc' } },
  reviewComments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
};

const router = express.Router();

async function resolveIssueForRequest(found, numberParam, userId) {
  const num = parseInt(numberParam, 10);
  if (!num) return { status: 400, message: 'Invalid issue number' };

  const access = await resolveProjectAccess(userId, found.project);
  requireProjectRead(access);

  const issue = await prisma.issue.findUnique({
    where: { projectId_number: { projectId: found.project.id, number: num } },
    include: issueInclude,
  });
  if (!issue) return { status: 404, message: 'Issue not found' };

  return { issue, access, num };
}

async function withViewerContext(found, userId) {
  const access = await resolveProjectAccess(userId, found.project);
  requireProjectRead(access);
  const engagement = await getProjectEngagement(found.project.id, userId);
  const project = formatProject(
    { ...found.project, openIssueCount: found.openIssueCount, openPullCount: found.openPullCount },
    found.pathOwner,
    {
      viewerRole: access.role,
      viewerPermissions: access,
      ...engagement,
    }
  );
  return { ...found, project, access, engagement };
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { q, limit = '30', categorySlug } = req.query;
    const take = Math.min(parseInt(limit, 10) || 30, 50);
    const where = {};
    if (categorySlug) {
      const cat = await categoryService.findCategoryBySlug(categorySlug);
      if (cat) where.categoryId = cat._id;
    }
    if (q && String(q).trim().length >= 2) {
      const text = String(q).trim();
      where.OR = [
        { name: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
        { slug: { contains: text, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
      take,
    });

    const projects = [];
    for (const p of rows) {
      const access = await resolveProjectAccess(req.user?._id, p);
      if (!access.read) continue;
      const openIssueCount = await prisma.issue.count({
        where: { projectId: p.id, status: 'open' },
      });
      const openPullCount = await prisma.pullRequest.count({
        where: { projectId: p.id, status: 'open' },
      });
      const pathOwner = p.organization?.slug || p.owner.username;
      projects.push(formatProject({ ...p, openIssueCount, openPullCount }, pathOwner));
    }

    res.json(projects);
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, slug, description, readme, categorySlug, organizationSlug } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const projectSlug = slugify(slug || name);
    if (!projectSlug) {
      return res.status(400).json({ message: 'Invalid project slug' });
    }

    let categoryId = null;
    if (categorySlug) {
      const cat = await categoryService.findCategoryBySlug(categorySlug);
      if (!cat) return res.status(400).json({ message: 'Category not found' });
      categoryId = cat._id;
    }

    let organizationId = null;
    let pathOwner = req.user.username;
    if (organizationSlug) {
      const ns = await resolveOwnerNamespace(organizationSlug);
      if (!ns || ns.type !== 'organization') {
        return res.status(404).json({ message: 'Organization not found' });
      }
      await requireOrgRole(ns.id, req.user._id, 'MEMBER');
      organizationId = ns.id;
      pathOwner = ns.slug;

      const existingOrg = await prisma.project.findUnique({
        where: { organizationId_slug: { organizationId, slug: projectSlug } },
      });
      if (existingOrg) {
        return res.status(409).json({ message: 'Organization already has a project with this slug' });
      }
    } else {
      const existing = await prisma.project.findUnique({
        where: { ownerId_slug: { ownerId: req.user._id, slug: projectSlug } },
      });
      if (existing) {
        return res.status(409).json({ message: 'You already have a project with this slug' });
      }
    }

    const row = await prisma.project.create({
      data: {
        name: name.trim(),
        slug: projectSlug,
        description: String(description || '').trim().slice(0, 2000),
        readme: String(readme || '').trim().slice(0, 32000),
        ownerId: req.user._id,
        organizationId,
        categoryId,
      },
      include: projectInclude,
    });

    await seedReadmeFromProject(row);
    await ensureDefaultBranchProtection(row.id, row.defaultBranch || 'main');

    res.status(201).json(
      formatProject({ ...row, openIssueCount: 0, openPullCount: 0 }, pathOwner, {
        viewerRole: 'OWNER',
        viewerPermissions: { role: 'OWNER', read: true, write: true, merge: true, admin: true, owner: true },
      })
    );
  })
);

router.post(
  '/:owner/:slug/fork',
  requireAuth,
  asyncHandler(async (req, res) => {
    const source = await findProjectByPath(req.params.owner, req.params.slug);
    if (!source) return res.status(404).json({ message: 'Project not found' });

    const forkSlug = slugify(req.body?.slug || `${source.project.slug}-fork`) || `${source.project.slug}-fork`;
    const existing = await prisma.project.findUnique({
      where: { ownerId_slug: { ownerId: req.user._id, slug: forkSlug } },
    });
    if (existing) {
      return res.status(409).json({ message: 'You already have a project with this fork slug' });
    }

    const files = await prisma.repoFile.findMany({
      where: { projectId: source.project.id },
    });

    const row = await prisma.project.create({
      data: {
        name: `${source.project.name} (fork)`,
        slug: forkSlug,
        description: source.project.description,
        readme: source.project.readme,
        ownerId: req.user._id,
        categoryId: source.project.categoryId,
        forkedFromId: source.project.id,
        repoFiles: {
          create: files.map((f) => ({
            branch: f.branch,
            path: f.path,
            content: f.content,
            updatedById: req.user._id,
          })),
        },
      },
      include: projectInclude,
    });

    await ensureDefaultBranchProtection(row.id, row.defaultBranch || 'main');

    res.status(201).json(
      formatProject({ ...row, openIssueCount: 0, openPullCount: 0 }, req.user.username, {
        viewerRole: 'OWNER',
        viewerPermissions: { role: 'OWNER', read: true, write: true, merge: true, admin: true, owner: true },
      })
    );
  })
);

router.get(
  '/:owner/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await withViewerContext(found, req.user?._id);
    res.json(ctx.project);
  })
);

router.get(
  '/:owner/:slug/collaborators',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'read');
    const items = await listCollaborators(found.project.id);
    res.json({ collaborators: items, viewerRole: access.role });
  })
);

router.post(
  '/:owner/:slug/collaborators',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'admin');
    const { username, role } = req.body;
    if (!username?.trim()) return res.status(400).json({ message: 'username is required' });
    try {
      const collab = await addCollaborator(found.project.id, username, role);
      res.status(201).json(collab);
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message });
    }
  })
);

router.patch(
  '/:owner/:slug/collaborators/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'admin');
    try {
      const collab = await updateCollaboratorRole(
        found.project.id,
        req.params.userId,
        req.body.role
      );
      res.json(collab);
    } catch (err) {
      return res.status(err.status || 404).json({ message: err.message || 'Collaborator not found' });
    }
  })
);

router.delete(
  '/:owner/:slug/collaborators/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'admin');
    try {
      await removeCollaborator(found.project.id, req.params.userId);
      res.json({ message: 'Removed' });
    } catch (err) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }
  })
);

router.get(
  '/:owner/:slug/protection',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const branch = resolveBranch(found.project, req.query.branch);
    const row = await prisma.branchProtection.findUnique({
      where: {
        projectId_branchPattern: { projectId: found.project.id, branchPattern: branch },
      },
    });
    res.json({
      branch,
      protection: formatBranchProtection(row) || {
        branchPattern: branch,
        requireCiSuccess: branch === 'main',
        requireReview: branch === 'main',
        requiredApprovalCount: 1,
      },
    });
  })
);

router.patch(
  '/:owner/:slug/protection',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'admin');

    const branchPattern = resolveBranch(found.project, req.body.branch || req.query.branch);
    const data = {};
    if (req.body.requireCiSuccess !== undefined) data.requireCiSuccess = Boolean(req.body.requireCiSuccess);
    if (req.body.requireReview !== undefined) data.requireReview = Boolean(req.body.requireReview);
    if (req.body.requiredApprovalCount !== undefined) {
      data.requiredApprovalCount = Math.min(
        10,
        Math.max(1, parseInt(req.body.requiredApprovalCount, 10) || 1)
      );
    }

    const row = await prisma.branchProtection.upsert({
      where: {
        projectId_branchPattern: { projectId: found.project.id, branchPattern },
      },
      create: {
        projectId: found.project.id,
        branchPattern,
        requireCiSuccess: data.requireCiSuccess ?? true,
        requireReview: data.requireReview ?? true,
        requiredApprovalCount: data.requiredApprovalCount ?? 1,
      },
      update: data,
    });

    res.json({ branch: branchPattern, protection: formatBranchProtection(row) });
  })
);

router.get(
  '/:owner/:slug/tree',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const branch = resolveBranch(found.project, req.query.branch);
    const files = await prisma.repoFile.findMany({
      where: { projectId: found.project.id, branch },
      select: { path: true, updatedAt: true },
      orderBy: { path: 'asc' },
    });

    const branches = await listBranches(found.project.id);

    res.json({
      project: formatProject(
        { ...found.project, openIssueCount: found.openIssueCount, openPullCount: found.openPullCount },
        found.pathOwner || found.owner.username
      ),
      tree: buildFileTree(files),
      branch,
      branches,
    });
  })
);

router.get(
  '/:owner/:slug/blob',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const branch = resolveBranch(found.project, req.query.branch);
    const path = normalizeRepoPath(req.query.path);
    if (!path) return res.status(400).json({ message: 'path is required' });

    const file = await prisma.repoFile.findUnique({
      where: {
        projectId_branch_path: { projectId: found.project.id, branch, path },
      },
      include: { updatedBy: true },
    });
    if (!file) return res.status(404).json({ message: 'File not found' });

    res.json({ file: formatRepoFile(file), branch });
  })
);

router.get(
  '/:owner/:slug/blame',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await withViewerContext(found, req.user?._id);
    const branch = resolveBranch(found.project, req.query.branch);
    const path = normalizeRepoPath(req.query.path);
    if (!path) return res.status(400).json({ message: 'path is required' });

    const file = await prisma.repoFile.findUnique({
      where: {
        projectId_branch_path: { projectId: found.project.id, branch, path },
      },
      include: { updatedBy: true },
    });
    if (!file) return res.status(404).json({ message: 'File not found' });

    const revisions = await prisma.repoFileRevision.findMany({
      where: { projectId: found.project.id, branch, path },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });

    const lines = computeBlameLines(revisions, file.content, file);

    res.json({
      project: ctx.project,
      path,
      branch,
      lines,
    });
  })
);

router.get(
  '/:owner/:slug/history',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await withViewerContext(found, req.user?._id);
    const branch = resolveBranch(found.project, req.query.branch);
    const path = normalizeRepoPath(req.query.path);
    if (!path) return res.status(400).json({ message: 'path is required' });

    const take = Math.min(parseInt(req.query.limit, 10) || 40, 100);
    const rows = await prisma.repoFileRevision.findMany({
      where: { projectId: found.project.id, branch, path },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({
      project: ctx.project,
      path,
      branch,
      revisions: rows.map((row) => formatRepoFileRevision(row)),
    });
  })
);

router.get(
  '/:owner/:slug/history/:revisionId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    await withViewerContext(found, req.user?._id);

    const row = await prisma.repoFileRevision.findFirst({
      where: {
        id: String(req.params.revisionId),
        projectId: found.project.id,
      },
      include: { author: true },
    });
    if (!row) return res.status(404).json({ message: 'Revision not found' });

    res.json({
      revision: formatRepoFileRevision(row, { includeContent: true }),
    });
  })
);

router.put(
  '/:owner/:slug/files',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const branch = resolveBranch(found.project, req.body.branch);
    const path = normalizeRepoPath(req.body.path);
    if (!path) return res.status(400).json({ message: 'Invalid path' });

    const { content, action } = req.body;
    if (action === 'delete') {
      await prisma.repoFile.deleteMany({
        where: { projectId: found.project.id, branch, path },
      });
      triggerCi(found.project.id, branch, 'push');
      return res.json({ message: 'Deleted', path, branch });
    }

    const file = await prisma.repoFile.upsert({
      where: {
        projectId_branch_path: { projectId: found.project.id, branch, path },
      },
      create: {
        projectId: found.project.id,
        branch,
        path,
        content: String(content || ''),
        updatedById: req.user._id,
      },
      update: {
        content: String(content || ''),
        updatedById: req.user._id,
      },
      include: { updatedBy: true },
    });

    if (branch === 'main' && path === 'README.md') {
      await prisma.project.update({
        where: { id: found.project.id },
        data: { readme: String(content || '').slice(0, 32000) },
      });
    }

    await recordRepoFileRevision({
      projectId: found.project.id,
      branch,
      path,
      content: String(content || ''),
      authorId: req.user._id,
    });

    triggerCi(found.project.id, branch, 'push');
    res.json({ file: formatRepoFile(file), branch });
  })
);

router.get(
  '/:owner/:slug/branches',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const branches = await listBranches(found.project.id);
    res.json({ branches, defaultBranch: found.project.defaultBranch || 'main' });
  })
);

router.post(
  '/:owner/:slug/branches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const { name, from } = req.body;
    try {
      const branch = await createBranch(found.project.id, name, from || found.project.defaultBranch);
      res.status(201).json({ branch });
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message });
    }
  })
);

router.get(
  '/:owner/:slug/archive.zip',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const branch = resolveBranch(found.project, req.query.branch);
    await sendProjectArchive(res, found.project, branch);
  })
);

router.get(
  '/:owner/:slug/clone',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const branch = resolveBranch(found.project, req.query.branch);
    const apiBase = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
    const owner = found.pathOwner || found.owner.username;
    const slug = found.project.slug;
    const gitBase = `${apiBase}/api/git/${owner}/${slug}`;
    const { gitSshRemoteUrl } = require('../utils/gitProject');
    const sshRemote = gitSshRemoteUrl(owner, slug);

    res.json({
      owner,
      slug,
      branch,
      defaultBranch: found.project.defaultBranch || 'main',
      zipUrl: `${apiBase}/api/projects/${owner}/${slug}/archive.zip?branch=${encodeURIComponent(branch)}`,
      neuronRemote: `neuron://${owner}/${slug}.git`,
      gitRemoteUrl: gitBase,
      sshRemoteUrl: sshRemote,
      bundleUrl: `${gitBase}/clone.bundle?branch=${encodeURIComponent(branch)}`,
      infoRefsUrl: `${gitBase}/info/refs?service=git-upload-pack`,
      uploadPackUrl: `${gitBase}/git-upload-pack`,
      receivePackUrl: `${gitBase}/git-receive-pack`,
      cloneFromHttp: `git clone ${gitBase} repo && cd repo && git checkout ${branch}`,
      cloneFromBundle: `git clone ${gitBase}/clone.bundle repo && cd repo && git checkout ${branch}`,
      cloneFromSsh: `git clone ${sshRemote}`,
      pushCommand: `git remote add neuron ${gitBase} && git push neuron ${branch}`,
      sshPushCommand: `git remote add neuron ${sshRemote} && git push neuron ${branch}`,
      note: 'ZIP, HTTP/SSH git, or web editor. SSH uses keys from Settings or PAT as password.',
    });
  })
);

router.get(
  '/:owner/:slug/actions/runs',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const runs = await prisma.workflowRun.findMany({
      where: { projectId: found.project.id },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });

    res.json({ runs: runs.map(formatWorkflowRun) });
  })
);

router.post(
  '/:owner/:slug/actions/run',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const branch = resolveBranch(found.project, req.body.branch);
    const run = await runWorkflow(found.project.id, branch, 'manual');
    if (!run) {
      return res.status(400).json({
        message: 'No .neuron/ci.yml found or workflow disabled for manual runs',
      });
    }
    res.status(201).json(formatWorkflowRun(run));
  })
);

router.get(
  '/:owner/:slug/pulls',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const status = req.query.status === 'all' ? null : req.query.status || 'open';
    const where = { projectId: found.project.id };
    if (status) where.status = status;

    const pulls = await prisma.pullRequest.findMany({
      where,
      include: { author: true, changes: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      project: formatProject(
        { ...found.project, openIssueCount: found.openIssueCount, openPullCount: found.openPullCount },
        found.pathOwner || found.owner.username
      ),
      pullRequests: pulls.map((pr) => formatPullRequest({ ...pr, changes: undefined })),
    });
  })
);

router.post(
  '/:owner/:slug/pulls',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const { title, body, changes, baseBranch: baseBranchBody, headBranch: headBranchBody } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'PR title is required' });
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ message: 'At least one file change is required' });
    }

    const baseBranch = resolveBranch(found.project, baseBranchBody);

    const agg = await prisma.pullRequest.aggregate({
      where: { projectId: found.project.id },
      _max: { number: true },
    });
    const number = (agg._max.number || 0) + 1;
    const headBranch =
      normalizeBranchName(headBranchBody) || `pr-${number}`;

    const normalized = [];
    for (const raw of changes) {
      const path = normalizeRepoPath(raw.path);
      if (!path) return res.status(400).json({ message: `Invalid path: ${raw.path}` });
      const action = String(raw.action || 'modify').toLowerCase();
      if (!['add', 'modify', 'delete'].includes(action)) {
        return res.status(400).json({ message: 'Invalid change action' });
      }
      const existing = await prisma.repoFile.findUnique({
        where: {
          projectId_branch_path: { projectId: found.project.id, branch: baseBranch, path },
        },
      });
      if (action === 'add' && existing) {
        return res.status(400).json({ message: `File already exists: ${path}` });
      }
      if ((action === 'modify' || action === 'delete') && !existing) {
        return res.status(400).json({ message: `File not found: ${path}` });
      }
      normalized.push({
        path,
        action,
        content: action === 'delete' ? '' : String(raw.content ?? existing?.content ?? ''),
        oldContent: existing?.content || '',
      });
    }

    try {
      await createBranch(found.project.id, headBranch, baseBranch);
    } catch (err) {
      if (err.status !== 409) throw err;
      return res.status(409).json({ message: 'Head branch already exists' });
    }
    await applyChangesToBranch(found.project.id, headBranch, normalized, req.user._id);

    const isDraft = req.body?.isDraft === true || req.body?.draft === true;

    const pr = await prisma.pullRequest.create({
      data: {
        projectId: found.project.id,
        number,
        title: title.trim(),
        body: String(body || '').trim().slice(0, 32000),
        authorId: req.user._id,
        isDraft,
        baseBranch,
        headBranch,
        changes: { create: normalized },
      },
      include: { author: true, changes: true, reviews: { include: { reviewer: true } } },
    });

    triggerCi(found.project.id, headBranch, 'pull_request', { pullRequestNumber: number });
    if (found.project.ownerId !== req.user._id) {
      await createNotification({
        userId: found.project.ownerId,
        type: 'project_pr_opened',
        title: `New PR in ${found.project.slug}`,
        body: `${req.user.username} opened #${number}: ${title.trim()}`,
        link: `/p/${found.pathOwner || found.owner.username}/${found.project.slug}/pulls/${number}`,
        actorId: req.user._id,
      });
    }

    const gate = await evaluateMergeGate(found.project.id, pr);
    res.status(201).json(
      formatPullRequest(pr, {
        mergeable: gate.ok,
        mergeChecks: gate.checks,
        viewerRole: access.role,
      })
    );
  })
);

router.get(
  '/:owner/:slug/pulls/:number',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
      include: pullRequestDetailInclude,
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const ctx = await withViewerContext(found, req.user?._id);
    const gate = await evaluateMergeGate(found.project.id, pr);

    res.json({
      project: ctx.project,
      pullRequest: formatPullRequest(pr, {
        mergeable: gate.ok,
        mergeChecks: gate.checks,
        viewerRole: ctx.access.role,
        viewerId: req.user?._id,
        canModerateComments: ctx.access.merge,
      }),
    });
  })
);

router.get(
  '/:owner/:slug/pulls/:number/reviews',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const reviews = await prisma.pullRequestReview.findMany({
      where: { pullRequestId: pr.id },
      include: { reviewer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reviews: reviews.map(formatPullRequestReview) });
  })
);

router.post(
  '/:owner/:slug/pulls/:number/reviews',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'read');

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });
    if (pr.status !== 'open') {
      return res.status(400).json({ message: 'Cannot review a closed pull request' });
    }

    const state = String(req.body.state || 'COMMENTED').toUpperCase();
    if (!['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(state)) {
      return res.status(400).json({ message: 'Invalid review state' });
    }
    if (pr.authorId === req.user._id && state === 'APPROVED') {
      return res.status(400).json({ message: 'Authors cannot approve their own pull request' });
    }

    const review = await prisma.pullRequestReview.create({
      data: {
        pullRequestId: pr.id,
        reviewerId: req.user._id,
        state,
        body: String(req.body.body || '').trim().slice(0, 8000),
      },
      include: { reviewer: true },
    });

    if (pr.authorId !== req.user._id) {
      await createNotification({
        userId: pr.authorId,
        type: 'project_pr_review',
        title: `Review on PR #${pr.number}`,
        body: `${req.user.username} ${state.toLowerCase().replace('_', ' ')}`,
        link: `/p/${found.pathOwner || found.owner.username}/${found.project.slug}/pulls/${pr.number}`,
        actorId: req.user._id,
      });
    }

    res.status(201).json(formatPullRequestReview(review));
  })
);

router.post(
  '/:owner/:slug/pulls/:number/merge',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'merge');

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
      include: { changes: true },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });
    if (pr.status !== 'open') {
      return res.status(400).json({ message: 'Pull request is not open' });
    }
    if (pr.isDraft) {
      return res.status(409).json({ message: 'Pull request is still a draft' });
    }

    const gate = await evaluateMergeGate(found.project.id, pr);
    if (!gate.ok) {
      return res.status(409).json({
        message: gate.message || 'Merge requirements not met',
        mergeChecks: gate.checks,
      });
    }

    const mergeMethod = normalizeMergeMethod(req.body?.mergeMethod || req.body?.method);
    const baseBranch = pr.baseBranch || found.project.defaultBranch || 'main';

    const changesToApply =
      mergeMethod === 'rebase'
        ? await refreshPullChangesFromBase(found.project.id, pr.changes, baseBranch)
        : pr.changes;

    await applyChangesToBranch(found.project.id, baseBranch, changesToApply, req.user._id);
    const { deletedHeadBranch } = await cleanupAfterMerge(found.project.id, pr, mergeMethod);
    triggerCi(found.project.id, baseBranch, 'push');

    const merged = await prisma.pullRequest.update({
      where: { id: pr.id },
      data: { status: 'merged', mergedAt: new Date() },
      include: pullRequestDetailInclude,
    });

    res.json(
      formatPullRequest(merged, {
        mergeable: true,
        mergeChecks: gate.checks,
        viewerRole: access.role,
        viewerId: req.user._id,
        mergeMethod,
        deletedHeadBranch,
      })
    );
  })
);

router.get(
  '/:owner/:slug/pulls/:number/comments',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const ctx = await withViewerContext(found, req.user?._id);
    const rows = await prisma.pullRequestReviewComment.findMany({
      where: { pullRequestId: pr.id },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      comments: rows.map((row) =>
        formatPullRequestReviewComment(row, {
          canEdit: req.user?._id === row.authorId,
          canDelete: req.user?._id === row.authorId || ctx.access.merge,
        })
      ),
    });
  })
);

router.post(
  '/:owner/:slug/pulls/:number/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'read');

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
      include: { author: true },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });
    if (pr.status !== 'open') {
      return res.status(400).json({ message: 'Cannot comment on a closed pull request' });
    }

    let parsed;
    try {
      parsed = validateInlineComment({
        path: req.body?.path,
        line: req.body?.line,
        body: req.body?.body,
      });
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message });
    }

    const row = await prisma.pullRequestReviewComment.create({
      data: {
        pullRequestId: pr.id,
        authorId: req.user._id,
        path: parsed.path,
        side: normalizeReviewSide(req.body?.side),
        line: parsed.line,
        body: parsed.body,
      },
      include: { author: true },
    });

    if (pr.authorId !== req.user._id) {
      await createNotification({
        userId: pr.authorId,
        type: 'project_pr_review',
        title: `Inline comment on PR #${pr.number}`,
        body: `${req.user.username} on ${parsed.path}:${parsed.line}`,
        link: `/p/${found.pathOwner || found.owner.username}/${found.project.slug}/pulls/${pr.number}`,
        actorId: req.user._id,
      });
    }

    res.status(201).json(
      formatPullRequestReviewComment(row, { canEdit: true, canDelete: true })
    );
  })
);

router.patch(
  '/:owner/:slug/pulls/:number/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const existing = await prisma.pullRequestReviewComment.findFirst({
      where: { id: String(req.params.commentId), pullRequestId: pr.id },
      include: { author: true },
    });
    if (!existing) return res.status(404).json({ message: 'Comment not found' });

    if (existing.authorId !== req.user._id) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const body = String(req.body?.body || '').trim().slice(0, 8000);
    if (!body) return res.status(400).json({ message: 'Comment body is required' });

    const row = await prisma.pullRequestReviewComment.update({
      where: { id: existing.id },
      data: { body },
      include: { author: true },
    });

    res.json(formatPullRequestReviewComment(row, { canEdit: true, canDelete: true }));
  })
);

router.delete(
  '/:owner/:slug/pulls/:number/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const existing = await prisma.pullRequestReviewComment.findFirst({
      where: { id: String(req.params.commentId), pullRequestId: pr.id },
    });
    if (!existing) return res.status(404).json({ message: 'Comment not found' });

    if (existing.authorId !== req.user._id) {
      requireProjectPermission(access, 'merge');
    }

    await prisma.pullRequestReviewComment.delete({ where: { id: existing.id } });
    res.json({ message: 'Comment deleted' });
  })
);

router.patch(
  '/:owner/:slug/pulls/:number',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const pr = await prisma.pullRequest.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!pr) return res.status(404).json({ message: 'Pull request not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    const isAuthor = pr.authorId === req.user._id;
    if (!isAuthor && !access.merge) return res.status(403).json({ message: 'Not allowed' });

    const { status, isDraft, draft } = req.body;
    const data = {};

    if (status !== undefined) {
      const s = String(status).toLowerCase();
      if (!['open', 'closed'].includes(s) || pr.status === 'merged') {
        return res.status(400).json({ message: 'Cannot update this pull request' });
      }
      data.status = s;
    }

    if (isDraft !== undefined || draft !== undefined) {
      if (!isAuthor) return res.status(403).json({ message: 'Only the author can change draft status' });
      if (pr.status !== 'open') {
        return res.status(400).json({ message: 'Cannot change draft status on a closed pull request' });
      }
      data.isDraft = isDraft === true || draft === true;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updated = await prisma.pullRequest.update({
      where: { id: pr.id },
      data,
      include: { author: true, changes: true, reviews: { include: { reviewer: true } } },
    });

    const gate = await evaluateMergeGate(found.project.id, updated);
    res.json(
      formatPullRequest(updated, {
        mergeable: gate.ok,
        mergeChecks: gate.checks,
        viewerRole: access.role,
      })
    );
  })
);

router.patch(
  '/:owner/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'admin');

    const { name, description, readme, visibility } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = String(description).trim().slice(0, 2000);
    if (readme !== undefined) data.readme = String(readme).trim().slice(0, 32000);
    if (visibility !== undefined) {
      const v = String(visibility).toUpperCase();
      if (!['PUBLIC', 'PRIVATE'].includes(v)) {
        return res.status(400).json({ message: 'visibility must be PUBLIC or PRIVATE' });
      }
      data.visibility = v;
    }
    if (data.name === '') return res.status(400).json({ message: 'Name cannot be empty' });

    const row = await prisma.project.update({
      where: { id: found.project.id },
      data,
      include: projectInclude,
    });

    const openIssueCount = await prisma.issue.count({
      where: { projectId: row.id, status: 'open' },
    });

    res.json(formatProject({ ...row, openIssueCount }, found.pathOwner || found.owner.username));
  })
);

router.get(
  '/:owner/:slug/issue-templates',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user?._id, found.project);
    requireProjectRead(access);
    const rows = await prisma.projectIssueTemplate.findMany({
      where: { projectId: found.project.id },
      orderBy: { name: 'asc' },
    });
    res.json({ templates: rows.map(formatIssueTemplate) });
  })
);

router.post(
  '/:owner/:slug/issue-templates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const name = normalizeTemplateName(req.body?.name);
    const title = String(req.body?.title || '').trim();
    if (!name) return res.status(400).json({ message: 'Template name is required' });
    if (!title) return res.status(400).json({ message: 'Template title is required' });

    const row = await prisma.projectIssueTemplate.create({
      data: {
        projectId: found.project.id,
        name,
        title,
        body: String(req.body?.body || '').trim().slice(0, 32000),
      },
    });
    res.status(201).json(formatIssueTemplate(row));
  })
);

router.delete(
  '/:owner/:slug/issue-templates/:templateId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');
    await prisma.projectIssueTemplate.deleteMany({
      where: { id: String(req.params.templateId), projectId: found.project.id },
    });
    res.json({ message: 'Template deleted' });
  })
);

router.post(
  '/:owner/:slug/star',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectRead(access);
    await prisma.projectStar.upsert({
      where: {
        userId_projectId: { userId: req.user._id, projectId: found.project.id },
      },
      create: { userId: req.user._id, projectId: found.project.id },
      update: {},
    });
    res.json(await getProjectEngagement(found.project.id, req.user._id));
  })
);

router.delete(
  '/:owner/:slug/star',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    await prisma.projectStar.deleteMany({
      where: { userId: req.user._id, projectId: found.project.id },
    });
    res.json(await getProjectEngagement(found.project.id, req.user._id));
  })
);

router.post(
  '/:owner/:slug/watch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectRead(access);
    await prisma.projectWatch.upsert({
      where: {
        userId_projectId: { userId: req.user._id, projectId: found.project.id },
      },
      create: { userId: req.user._id, projectId: found.project.id },
      update: {},
    });
    res.json(await getProjectEngagement(found.project.id, req.user._id));
  })
);

router.delete(
  '/:owner/:slug/watch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    await prisma.projectWatch.deleteMany({
      where: { userId: req.user._id, projectId: found.project.id },
    });
    res.json(await getProjectEngagement(found.project.id, req.user._id));
  })
);

router.delete(
  '/:owner/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    if (found.project.ownerId !== req.user._id) {
      return res.status(403).json({ message: 'Only the project owner can delete it' });
    }
    await prisma.project.delete({ where: { id: found.project.id } });
    res.json({ message: 'Project deleted' });
  })
);

router.get(
  '/:owner/:slug/issues',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const status = req.query.status === 'closed' ? 'closed' : req.query.status === 'all' ? null : 'open';
    const labelParam = req.query.label ? String(req.query.label) : '';
    const milestoneParam = req.query.milestone ? String(req.query.milestone) : '';

    const access = await resolveProjectAccess(req.user?._id, found.project);
    requireProjectRead(access);

    const where = { projectId: found.project.id };
    if (status) where.status = status;
    if (labelParam === 'none') {
      where.labels = { none: {} };
    } else if (labelParam) {
      where.labels = { some: { labelId: labelParam } };
    }
    if (milestoneParam === 'none') {
      where.milestoneId = null;
    } else if (milestoneParam) {
      where.milestoneId = milestoneParam;
    }

    const [issues, labels, milestones] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: issueInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.projectLabel.findMany({
        where: { projectId: found.project.id },
        orderBy: { name: 'asc' },
      }),
      prisma.projectMilestone.findMany({
        where: { projectId: found.project.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const milestoneCounts = await Promise.all(
      milestones.map(async (m) => {
        const openIssueCount = await prisma.issue.count({
          where: { projectId: found.project.id, milestoneId: m.id, status: 'open' },
        });
        return formatProjectMilestone({ ...m, openIssueCount });
      })
    );

    res.json({
      project: formatProject(
        { ...found.project, openIssueCount: found.openIssueCount, openPullCount: found.openPullCount },
        found.pathOwner || found.owner.username,
        { viewerRole: access.role, viewerPermissions: access }
      ),
      issues: issues.map(formatIssue),
      labels: labels.map(formatProjectLabel),
      milestones: milestoneCounts,
    });
  })
);

router.post(
  '/:owner/:slug/issues',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const { title, body, openDiscussion, categorySlug, labelIds, assigneeIds, milestoneId } =
      req.body;
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Issue title is required' });
    }

    const agg = await prisma.issue.aggregate({
      where: { projectId: found.project.id },
      _max: { number: true },
    });
    const number = (agg._max.number || 0) + 1;

    let threadId = null;
    if (openDiscussion) {
      let categoryId = found.project.categoryId;
      if (categorySlug) {
        const cat = await categoryService.findCategoryBySlug(categorySlug);
        if (cat) categoryId = cat._id;
      }
      if (!categoryId) {
        const firstCategory = await categoryService.findFirstCategory();
        categoryId = firstCategory?._id;
      }
      if (!categoryId) {
        return res.status(400).json({ message: 'No field available for discussion thread' });
      }

      const thread = await threadService.createThread({
        title: title.trim(),
        body: String(body || '').trim(),
        authorId: req.user._id,
        categoryId,
      });
      threadId = thread._id;
    }

    const resolvedMilestoneId = await resolveMilestoneId(prisma, {
      projectId: found.project.id,
      milestoneId,
    });

    const issue = await prisma.issue.create({
      data: {
        projectId: found.project.id,
        number,
        title: title.trim(),
        body: String(body || '').trim().slice(0, 32000),
        authorId: req.user._id,
        threadId,
        milestoneId: resolvedMilestoneId === undefined ? undefined : resolvedMilestoneId,
      },
      include: issueInclude,
    });

    if (labelIds !== undefined) {
      await syncIssueLabels(prisma, {
        issueId: issue.id,
        projectId: found.project.id,
        labelIds,
      });
    }
    if (assigneeIds !== undefined) {
      await syncIssueAssignees(prisma, {
        issueId: issue.id,
        projectId: found.project.id,
        assigneeIds,
      });
    }

    await prisma.project.update({
      where: { id: found.project.id },
      data: { updatedAt: new Date() },
    });
    if (found.project.ownerId !== req.user._id) {
      await createNotification({
        userId: found.project.ownerId,
        type: 'project_issue_opened',
        title: `New issue in ${found.project.slug}`,
        body: `${req.user.username} opened #${number}: ${title.trim()}`,
        link: `/p/${found.pathOwner || found.owner.username}/${found.project.slug}/issues/${number}`,
        actorId: req.user._id,
      });
    }

    const withLabels = await prisma.issue.findUnique({
      where: { id: issue.id },
      include: issueInclude,
    });
    res.status(201).json(formatIssue(withLabels));
  })
);

router.get(
  '/:owner/:slug/issues/:number',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    if (!num) return res.status(400).json({ message: 'Invalid issue number' });

    const issue = await prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: found.project.id, number: num },
      },
      include: {
        ...issueInclude,
        project: { include: { owner: true, category: true } },
      },
    });

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const access = await resolveProjectAccess(req.user?._id, found.project);
    requireProjectRead(access);

    const [labels, milestoneRows, collabRows] = await Promise.all([
      prisma.projectLabel.findMany({
        where: { projectId: found.project.id },
        orderBy: { name: 'asc' },
      }),
      prisma.projectMilestone.findMany({
        where: { projectId: found.project.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.projectCollaborator.findMany({
        where: { projectId: found.project.id },
        include: { user: true },
      }),
    ]);

    const milestones = await Promise.all(
      milestoneRows.map(async (m) => {
        const openIssueCount = await prisma.issue.count({
          where: { projectId: found.project.id, milestoneId: m.id, status: 'open' },
        });
        return formatProjectMilestone({ ...m, openIssueCount });
      })
    );

    const assigneeCandidates = [
      found.project.owner,
      ...collabRows.map((c) => c.user),
    ].filter(Boolean);

    const commentCount = await prisma.issueComment.count({
      where: { issueId: issue.id, deletedAt: null },
    });

    res.json({
      project: formatProject(
        { ...found.project, openIssueCount: found.openIssueCount, openPullCount: found.openPullCount },
        found.pathOwner || found.owner.username,
        { viewerRole: access.role, viewerPermissions: access }
      ),
      issue: formatIssue(issue, { commentCount }),
      labels: labels.map(formatProjectLabel),
      milestones,
      assigneeCandidates: assigneeCandidates.map((u) => ({
        _id: u.id,
        username: u.username,
        displayName: u.displayName,
      })),
    });
  })
);

router.get(
  '/:owner/:slug/milestones',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user?._id, found.project);
    requireProjectRead(access);

    const rows = await prisma.projectMilestone.findMany({
      where: { projectId: found.project.id },
      orderBy: { createdAt: 'asc' },
    });
    const milestones = await Promise.all(
      rows.map(async (m) => {
        const openIssueCount = await prisma.issue.count({
          where: { projectId: found.project.id, milestoneId: m.id, status: 'open' },
        });
        return formatProjectMilestone({ ...m, openIssueCount });
      })
    );
    res.json({ milestones });
  })
);

router.post(
  '/:owner/:slug/milestones',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const title = normalizeMilestoneTitle(req.body?.title);
    if (!title) return res.status(400).json({ message: 'Milestone title is required' });

    const row = await prisma.projectMilestone.create({
      data: {
        projectId: found.project.id,
        title,
        description: String(req.body?.description || '').trim().slice(0, 2000),
        dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : null,
      },
    });
    res.status(201).json(formatProjectMilestone({ ...row, openIssueCount: 0 }));
  })
);

router.patch(
  '/:owner/:slug/milestones/:milestoneId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const data = {};
    if (req.body?.title !== undefined) {
      const title = normalizeMilestoneTitle(req.body.title);
      if (!title) return res.status(400).json({ message: 'Milestone title is required' });
      data.title = title;
    }
    if (req.body?.description !== undefined) {
      data.description = String(req.body.description).trim().slice(0, 2000);
    }
    if (req.body?.state !== undefined) {
      const state = String(req.body.state).toLowerCase();
      if (!['open', 'closed'].includes(state)) {
        return res.status(400).json({ message: 'state must be open or closed' });
      }
      data.state = state;
    }
    if (req.body?.dueAt !== undefined) {
      data.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    }

    const row = await prisma.projectMilestone.updateMany({
      where: { id: String(req.params.milestoneId), projectId: found.project.id },
      data,
    });
    if (!row.count) return res.status(404).json({ message: 'Milestone not found' });

    const updated = await prisma.projectMilestone.findUnique({
      where: { id: String(req.params.milestoneId) },
    });
    const openIssueCount = await prisma.issue.count({
      where: { projectId: found.project.id, milestoneId: updated.id, status: 'open' },
    });
    res.json(formatProjectMilestone({ ...updated, openIssueCount }));
  })
);

router.delete(
  '/:owner/:slug/milestones/:milestoneId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    await prisma.projectMilestone.deleteMany({
      where: { id: String(req.params.milestoneId), projectId: found.project.id },
    });
    res.json({ message: 'Milestone deleted' });
  })
);

router.get(
  '/:owner/:slug/labels',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user?._id, found.project);
    requireProjectRead(access);
    const labels = await prisma.projectLabel.findMany({
      where: { projectId: found.project.id },
      orderBy: { name: 'asc' },
    });
    res.json({ labels: labels.map(formatProjectLabel) });
  })
);

router.post(
  '/:owner/:slug/labels',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const name = normalizeLabelName(req.body?.name);
    if (!name) return res.status(400).json({ message: 'Label name is required' });

    const row = await prisma.projectLabel.create({
      data: {
        projectId: found.project.id,
        name,
        color: normalizeLabelColor(req.body?.color),
      },
    });
    res.status(201).json(formatProjectLabel(row));
  })
);

router.delete(
  '/:owner/:slug/labels/:labelId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    await prisma.projectLabel.deleteMany({
      where: { id: String(req.params.labelId), projectId: found.project.id },
    });
    res.json({ message: 'Label deleted' });
  })
);

router.get(
  '/:owner/:slug/issues/:number/comments',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await resolveIssueForRequest(found, req.params.number, req.user?._id);
    if (ctx.status) return res.status(ctx.status).json({ message: ctx.message });

    const rows = await prisma.issueComment.findMany({
      where: { issueId: ctx.issue.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });

    const canModerate = ctx.access.write === true;
    const viewerId = req.user?._id;
    res.json({
      comments: rows.map((row) =>
        formatIssueComment({
          ...row,
          canEdit: viewerId === row.authorId,
          canDelete: viewerId === row.authorId || canModerate,
        })
      ),
    });
  })
);

router.post(
  '/:owner/:slug/issues/:number/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await resolveIssueForRequest(found, req.params.number, req.user._id);
    if (ctx.status) return res.status(ctx.status).json({ message: ctx.message });

    const body = normalizeIssueCommentBody(req.body?.body);
    if (!body) return res.status(400).json({ message: 'Comment body is required' });

    const row = await prisma.issueComment.create({
      data: {
        issueId: ctx.issue.id,
        authorId: req.user._id,
        body,
      },
      include: { author: true },
    });

    await prisma.issue.update({
      where: { id: ctx.issue.id },
      data: { updatedAt: new Date() },
    });

    await notifyIssueCommentRecipients({
      prisma,
      createNotification,
      issue: ctx.issue,
      project: found.project,
      pathOwner: found.pathOwner || found.owner.username,
      number: ctx.num,
      commenterId: req.user._id,
      commenterUsername: req.user.username,
      commentId: row.id,
    });

    res.status(201).json(
      formatIssueComment({
        ...row,
        canEdit: true,
        canDelete: true,
      })
    );
  })
);

router.patch(
  '/:owner/:slug/issues/:number/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await resolveIssueForRequest(found, req.params.number, req.user._id);
    if (ctx.status) return res.status(ctx.status).json({ message: ctx.message });

    const existing = await prisma.issueComment.findFirst({
      where: { id: String(req.params.commentId), issueId: ctx.issue.id },
      include: { author: true },
    });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    if (existing.authorId !== req.user._id) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const body = normalizeIssueCommentBody(req.body?.body);
    if (!body) return res.status(400).json({ message: 'Comment body is required' });

    const row = await prisma.issueComment.update({
      where: { id: existing.id },
      data: { body },
      include: { author: true },
    });

    res.json(
      formatIssueComment({
        ...row,
        canEdit: true,
        canDelete: true,
      })
    );
  })
);

router.delete(
  '/:owner/:slug/issues/:number/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const ctx = await resolveIssueForRequest(found, req.params.number, req.user._id);
    if (ctx.status) return res.status(ctx.status).json({ message: ctx.message });

    const existing = await prisma.issueComment.findFirst({
      where: { id: String(req.params.commentId), issueId: ctx.issue.id },
    });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const isAuthor = existing.authorId === req.user._id;
    if (!isAuthor) {
      requireProjectPermission(ctx.access, 'write');
    }

    await prisma.issueComment.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), body: '' },
    });

    res.json({ message: 'Comment deleted' });
  })
);

router.patch(
  '/:owner/:slug/issues/:number',
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });

    const num = parseInt(req.params.number, 10);
    const issue = await prisma.issue.findUnique({
      where: { projectId_number: { projectId: found.project.id, number: num } },
    });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const isOwner = found.project.ownerId === req.user._id;
    const isAuthor = issue.authorId === req.user._id;
    if (!isOwner && !isAuthor) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const { title, body, status, labelIds, assigneeIds, milestoneId } = req.body;
    const data = {};
    if (title !== undefined && isAuthor) data.title = String(title).trim();
    if (body !== undefined && isAuthor) data.body = String(body).trim().slice(0, 32000);
    if (status !== undefined && (isOwner || isAuthor)) {
      const s = String(status).toLowerCase();
      if (!['open', 'closed'].includes(s)) {
        return res.status(400).json({ message: 'Status must be open or closed' });
      }
      data.status = s;
    }

    if (milestoneId !== undefined) {
      const access = await resolveProjectAccess(req.user._id, found.project);
      requireProjectPermission(access, 'write');
      data.milestoneId = await resolveMilestoneId(prisma, {
        projectId: found.project.id,
        milestoneId,
      });
    }

    const updated = await prisma.issue.update({
      where: { id: issue.id },
      data,
      include: issueInclude,
    });

    if (labelIds !== undefined) {
      const access = await resolveProjectAccess(req.user._id, found.project);
      requireProjectPermission(access, 'write');
      await syncIssueLabels(prisma, {
        issueId: issue.id,
        projectId: found.project.id,
        labelIds,
      });
    }
    if (assigneeIds !== undefined) {
      const access = await resolveProjectAccess(req.user._id, found.project);
      requireProjectPermission(access, 'write');
      await syncIssueAssignees(prisma, {
        issueId: issue.id,
        projectId: found.project.id,
        assigneeIds,
      });
    }

    const withLabels = await prisma.issue.findUnique({
      where: { id: issue.id },
      include: issueInclude,
    });
    res.json(formatIssue(withLabels));
  })
);

module.exports = router;
