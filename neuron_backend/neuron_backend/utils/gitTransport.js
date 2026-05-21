const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { getBranchFiles, applyChangesToBranch } = require('./repoFiles');
const { listBranches, ensureBranch } = require('./repoBranch');
const { getBranchProtection } = require('./mergeGate');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, shell: process.platform === 'win32' });
    let stdout = Buffer.alloc(0);
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout = Buffer.concat([stdout, d]);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exited ${code}`));
    });
  });
}

function runInteractive(cmd, args, input, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, shell: process.platform === 'win32' });
    let stdout = Buffer.alloc(0);
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout = Buffer.concat([stdout, d]);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.stdin.write(input);
    child.stdin.end();
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exited ${code}`));
    });
  });
}

function clearWorktree(tmp) {
  for (const ent of fs.readdirSync(tmp, { withFileTypes: true })) {
    if (ent.name === '.git') continue;
    fs.rmSync(path.join(tmp, ent.name), { recursive: true, force: true });
  }
}

function pktLine(str) {
  const payload = Buffer.from(str, 'utf8');
  const hex = (payload.length + 4).toString(16).padStart(4, '0');
  return Buffer.concat([Buffer.from(hex, 'utf8'), payload]);
}

function serviceAdvertisement(service, body) {
  return Buffer.concat([pktLine(`# service=${service}\n`), Buffer.from('0000', 'utf8'), body]);
}

async function exportBranchToGitWorktree(projectId, branch) {
  const files = await getBranchFiles(projectId, branch);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neuron-git-'));
  for (const file of files) {
    const full = path.join(tmp, file.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.content, 'utf8');
  }
  await run('git', ['init'], { cwd: tmp });
  await run('git', ['config', 'user.email', 'neuron@localhost'], { cwd: tmp });
  await run('git', ['config', 'user.name', 'Neuron'], { cwd: tmp });
  await run('git', ['add', '-A'], { cwd: tmp });
  try {
    await run('git', ['commit', '-m', 'Neuron snapshot', '--allow-empty'], { cwd: tmp });
  } catch {
    await run('git', ['commit', '-m', 'Neuron snapshot'], { cwd: tmp });
  }
  await run('git', ['branch', '-M', branch || 'main'], { cwd: tmp });
  return tmp;
}

async function exportProjectToGitRepo(projectId) {
  const branches = await listBranches(projectId);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neuron-git-full-'));

  await run('git', ['init'], { cwd: tmp });
  await run('git', ['config', 'user.email', 'neuron@localhost'], { cwd: tmp });
  await run('git', ['config', 'user.name', 'Neuron'], { cwd: tmp });

  for (const { name } of branches) {
    clearWorktree(tmp);
    await run('git', ['checkout', '--orphan', name], { cwd: tmp });
    const files = await getBranchFiles(projectId, name);
    for (const file of files) {
      const full = path.join(tmp, file.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, file.content, 'utf8');
    }
    await run('git', ['add', '-A'], { cwd: tmp });
    try {
      await run('git', ['commit', '-m', `Neuron snapshot ${name}`, '--allow-empty'], { cwd: tmp });
    } catch {
      await run('git', ['commit', '-m', `Neuron snapshot ${name}`], { cwd: tmp });
    }
  }

  const defaultBranch = branches.find((b) => b.isDefault)?.name || branches[0]?.name || 'main';
  await run('git', ['checkout', defaultBranch], { cwd: tmp });
  return tmp;
}

async function getHeadRefs(repoPath) {
  const out = await run(
    'git',
    ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads/'],
    { cwd: repoPath }
  );
  const map = new Map();
  for (const line of out.toString().split('\n').filter(Boolean)) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    map.set(line.slice(0, space), line.slice(space + 1));
  }
  return map;
}

async function getInfoRefs(projectId, branch) {
  const tmp = await exportBranchToGitWorktree(projectId, branch);
  try {
    const out = await run('git', ['show-ref'], { cwd: tmp });
    return out.toString();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function advertiseRefs(repoPath, service) {
  const subcommand = service === 'git-receive-pack' ? 'receive-pack' : 'upload-pack';
  return run('git', [subcommand, '--advertise-refs', '.'], { cwd: repoPath });
}

async function processReceivePack(repoPath, body) {
  return runInteractive('git', ['receive-pack', '--stateless-rpc', '.'], body, { cwd: repoPath });
}

async function processUploadPack(repoPath, body) {
  return runInteractive('git', ['upload-pack', '--stateless-rpc', '.'], body, { cwd: repoPath });
}

function pipeGitPack(subcommand, repoPath, sessionStream) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [subcommand, '--stateless-rpc', '.'], {
      cwd: repoPath,
      shell: process.platform === 'win32',
    });

    sessionStream.pipe(child.stdin);
    child.stdout.pipe(sessionStream, { end: false });
    if (sessionStream.stderr) {
      child.stderr.pipe(sessionStream.stderr, { end: false });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        sessionStream.end();
        return resolve();
      }
      reject(new Error(`git ${subcommand} exited ${code}`));
    });
  });
}

function isProtectedBranchPushAllowed(protection, access) {
  const isProtected = Boolean(protection?.requireCiSuccess || protection?.requireReview);
  if (isProtected && !access?.merge) return false;
  return true;
}

async function assertCanPushBranch(projectId, branchName, access) {
  const protection = await getBranchProtection(projectId, branchName);
  if (!isProtectedBranchPushAllowed(protection, access)) {
    throw Object.assign(
      new Error(`Branch "${branchName}" is protected. Open a pull request or push as maintainer.`),
      { status: 403 }
    );
  }
}

async function syncBranchFromRepo(projectId, repoPath, branchName, userId) {
  await ensureBranch(projectId, branchName);

  const pathsOut = await run('git', ['ls-tree', '-r', branchName, '--name-only'], { cwd: repoPath });
  const gitPaths = pathsOut
    .toString()
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const existing = await getBranchFiles(projectId, branchName);
  const changes = [];

  for (const file of existing) {
    if (!gitPaths.includes(file.path)) {
      changes.push({ path: file.path, action: 'delete' });
    }
  }

  for (const filePath of gitPaths) {
    const content = await run('git', ['show', `${branchName}:${filePath}`], { cwd: repoPath });
    changes.push({ path: filePath, content: content.toString('utf8'), action: 'upsert' });
  }

  if (changes.length > 0) {
    await applyChangesToBranch(projectId, branchName, changes, userId);
  }
}

async function syncGitRepoToDatabase(projectId, repoPath, userId, access, beforeRefs) {
  const afterRefs = await getHeadRefs(repoPath);
  const changed = [];

  for (const [branch, sha] of afterRefs.entries()) {
    if (beforeRefs.get(branch) !== sha) {
      changed.push(branch);
    }
  }

  for (const branch of afterRefs.keys()) {
    if (!beforeRefs.has(branch)) {
      changed.push(branch);
    }
  }

  const uniqueBranches = [...new Set(changed)];
  for (const branch of uniqueBranches) {
    await assertCanPushBranch(projectId, branch, access);
  }

  for (const branch of uniqueBranches) {
    await syncBranchFromRepo(projectId, repoPath, branch, userId);
  }

  return uniqueBranches;
}

async function createGitBundle(projectId, branch) {
  const tmp = await exportBranchToGitWorktree(projectId, branch);
  const bundlePath = path.join(tmp, 'repo.bundle');
  try {
    await run('git', ['bundle', 'create', bundlePath, '--all'], { cwd: tmp });
    return fs.readFileSync(bundlePath);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function isGitAvailable() {
  return new Promise((resolve) => {
    const child = spawn('git', ['--version'], { shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

module.exports = {
  exportBranchToGitWorktree,
  exportProjectToGitRepo,
  getInfoRefs,
  getHeadRefs,
  advertiseRefs,
  processReceivePack,
  processUploadPack,
  pipeGitPack,
  syncGitRepoToDatabase,
  syncBranchFromRepo,
  serviceAdvertisement,
  createGitBundle,
  isGitAvailable,
  assertCanPushBranch,
  isProtectedBranchPushAllowed,
};
