const express = require('express');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const { requireGitAuth, resolveGitUser } = require('../middleware/gitAuth');
const { resolveGitReadContext } = require('../utils/gitAccess');
const { resolveBranch } = require('../utils/repoBranch');
const { resolveProjectAccess, requireProjectPermission } = require('../utils/projectAccess');
const { triggerCi } = require('../utils/ciRunner');
const { findProjectByPath, gitHttpBaseUrl, gitSshRemoteUrl } = require('../utils/gitProject');
const {
  createGitBundle,
  exportProjectToGitRepo,
  exportBranchToGitWorktree,
  advertiseRefs,
  processReceivePack,
  processUploadPack,
  syncGitRepoToDatabase,
  getHeadRefs,
  getInfoRefs,
  serviceAdvertisement,
  isGitAvailable,
} = require('../utils/gitTransport');

const router = express.Router({ mergeParams: true });

router.get(
  '/info/refs',
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    if (!(await isGitAvailable())) {
      return res.status(503).json({ message: 'Git is not available on this server' });
    }

    const service = String(req.query.service || '').trim();
    const branch = resolveBranch(found.project, req.query.branch);

    if (service === 'git-receive-pack') {
      const user = await resolveGitUser(req);
      if (!user) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Neuron Git"');
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: 'Account banned' });
      }
      req.user = user;

      const access = await resolveProjectAccess(req.user._id, found.project);
      requireProjectPermission(access, 'write');

      const repoPath = await exportProjectToGitRepo(found.project.id);
      try {
        const ads = await advertiseRefs(repoPath, service);
        res.setHeader('Content-Type', `application/x-${service}-advertisement`);
        res.send(serviceAdvertisement(service, ads));
      } finally {
        fs.rmSync(repoPath, { recursive: true, force: true });
      }
      return;
    }

    if (service === 'git-upload-pack') {
      const ctx = await resolveGitReadContext(req, res, found.project);
      if (!ctx) return;

      const repoPath = await exportProjectToGitRepo(found.project.id);
      try {
        const ads = await advertiseRefs(repoPath, service);
        res.setHeader('Content-Type', `application/x-${service}-advertisement`);
        res.send(serviceAdvertisement(service, ads));
      } finally {
        fs.rmSync(repoPath, { recursive: true, force: true });
      }
      return;
    }

    const refs = await getInfoRefs(found.project.id, branch);
    res.type('text/plain').send(refs);
  })
);

router.post(
  '/git-upload-pack',
  express.raw({ type: '*/*', limit: '50mb' }),
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    if (!(await isGitAvailable())) {
      return res.status(503).json({ message: 'Git is not available on this server' });
    }

    const ctx = await resolveGitReadContext(req, res, found.project);
    if (!ctx) return;

    const repoPath = await exportProjectToGitRepo(found.project.id);
    try {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const output = await processUploadPack(repoPath, body);
      res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
      res.send(output);
    } finally {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  })
);

router.post(
  '/git-receive-pack',
  express.raw({ type: '*/*', limit: '50mb' }),
  requireGitAuth,
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    if (!(await isGitAvailable())) {
      return res.status(503).json({ message: 'Git is not available on this server' });
    }

    const access = await resolveProjectAccess(req.user._id, found.project);
    requireProjectPermission(access, 'write');

    const repoPath = await exportProjectToGitRepo(found.project.id);
    const beforeRefs = await getHeadRefs(repoPath);

    try {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const output = await processReceivePack(repoPath, body);
      const updatedBranches = await syncGitRepoToDatabase(
        found.project.id,
        repoPath,
        req.user._id,
        access,
        beforeRefs
      );

      for (const branch of updatedBranches) {
        triggerCi(found.project.id, branch, 'push');
      }

      res.setHeader('Content-Type', 'application/x-git-receive-pack-result');
      res.send(output);
    } finally {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  })
);

router.get(
  '/clone.bundle',
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    if (!(await isGitAvailable())) {
      return res.status(503).json({ message: 'Git is not available on this server' });
    }
    const branch = resolveBranch(found.project, req.query.branch);
    const bundle = await createGitBundle(found.project.id, branch);
    const filename = `${found.owner.username}-${found.project.slug}.bundle`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bundle);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const found = await findProjectByPath(req.params.owner, req.params.slug);
    if (!found) return res.status(404).json({ message: 'Project not found' });
    const branch = resolveBranch(found.project, req.query.branch);
    const base = `${gitHttpBaseUrl(req)}/api/git/${found.owner.username}/${found.project.slug}`;
    const sshRemote = gitSshRemoteUrl(found.owner.username, found.project.slug);

    res.json({
      owner: found.owner.username,
      slug: found.project.slug,
      branch,
      gitRemoteUrl: base,
      sshRemoteUrl: sshRemote,
      infoRefsUrl: `${base}/info/refs?service=git-upload-pack`,
      uploadPackUrl: `${base}/git-upload-pack`,
      receivePackUrl: `${base}/git-receive-pack`,
      bundleUrl: `${base}/clone.bundle?branch=${encodeURIComponent(branch)}`,
      cloneFromHttp: `git clone ${base} repo && cd repo && git checkout ${branch}`,
      cloneFromBundle: `git clone ${base}/clone.bundle repo && cd repo && git checkout ${branch}`,
      cloneFromSsh: `git clone ${sshRemote}`,
      pushCommand: `git remote add neuron ${base} && git push neuron ${branch}`,
      sshPushCommand: `git remote add neuron ${sshRemote} && git push neuron ${branch}`,
      authNote:
        'HTTP: username + PAT (nrn_…). SSH: registered public key or PAT as password. User: git (or SSH_GIT_USER).',
      note: 'Smart HTTP and SSH git transport with DB-backed repos.',
    });
  })
);

module.exports = router;
