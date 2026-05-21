const fs = require('fs');
const { generateKeyPairSync } = require('crypto');
const { Server } = require('ssh2');
const { captureException } = require('./sentry');
const { parseGitSshCommand } = require('./gitSshCommand');
const { findProjectByPath } = require('./gitProject');
const { findUserBySshPublicKey } = require('./sshKeys');
const { authenticatePersonalAccessToken } = require('./pat');
const { resolveProjectAccess, requireProjectPermission } = require('./projectAccess');
const { triggerCi } = require('./ciRunner');
const {
  exportProjectToGitRepo,
  getHeadRefs,
  pipeGitPack,
  syncGitRepoToDatabase,
  isGitAvailable,
} = require('./gitTransport');

function loadHostKey() {
  const inline = process.env.SSH_GIT_HOST_KEY;
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }
  const keyPath = process.env.SSH_GIT_HOST_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }

  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  console.warn('[git-ssh] SSH_GIT_HOST_KEY not set — using ephemeral RSA host key (not for production)');
  return privateKey;
}

async function handleGitExec(user, command, stream) {
  if (!user) {
    stream.stderr.write('Authentication required\n');
    stream.exit(1);
    return;
  }

  if (!(await isGitAvailable())) {
    stream.stderr.write('Git is not available on this server\n');
    stream.exit(1);
    return;
  }

  const parsed = parseGitSshCommand(command);
  if (!parsed) {
    stream.stderr.write(`Unsupported command: ${command}\n`);
    stream.exit(1);
    return;
  }

  const found = await findProjectByPath(parsed.owner, parsed.slug);
  if (!found) {
    stream.stderr.write('Project not found\n');
    stream.exit(1);
    return;
  }

  const access = await resolveProjectAccess(user._id, found.project);

  if (parsed.type === 'upload-pack') {
    try {
      requireProjectPermission(access, 'read');
    } catch (err) {
      stream.stderr.write(`${err.message}\n`);
      stream.exit(1);
      return;
    }
    const repoPath = await exportProjectToGitRepo(found.project.id);
    try {
      await pipeGitPack('upload-pack', repoPath, stream);
      stream.exit(0);
    } catch (err) {
      stream.stderr.write(`${err.message}\n`);
      stream.exit(1);
    } finally {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    return;
  }

  if (parsed.type === 'receive-pack') {
    try {
      requireProjectPermission(access, 'write');
    } catch (err) {
      stream.stderr.write(`${err.message}\n`);
      stream.exit(1);
      return;
    }
    const repoPath = await exportProjectToGitRepo(found.project.id);
    const beforeRefs = await getHeadRefs(repoPath);
    try {
      await pipeGitPack('receive-pack', repoPath, stream);
      const updatedBranches = await syncGitRepoToDatabase(
        found.project.id,
        repoPath,
        user._id,
        access,
        beforeRefs
      );
      for (const branch of updatedBranches) {
        triggerCi(found.project.id, branch, 'push');
      }
      stream.exit(0);
    } catch (err) {
      stream.stderr.write(`${err.message}\n`);
      stream.exit(1);
    } finally {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    return;
  }

  stream.stderr.write('Unsupported git service\n');
  stream.exit(1);
}

function startGitSshServer() {
  const port = Number(process.env.SSH_GIT_PORT || 0);
  if (!port) {
    return null;
  }

  const hostKey = loadHostKey();
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    let authedUser = null;

    client.on('authentication', (ctx) => {
      if (ctx.method === 'publickey') {
        findUserBySshPublicKey(ctx.key.data)
          .then((user) => {
            if (!user) {
              return ctx.reject(['publickey', 'password']);
            }
            authedUser = user;
            if (ctx.signature) {
              if (ctx.verify()) ctx.accept();
              else ctx.reject(['publickey']);
            } else {
              ctx.accept();
            }
          })
          .catch(() => ctx.reject(['publickey', 'password']));
        return;
      }

      if (ctx.method === 'password') {
        authenticatePersonalAccessToken(ctx.password, { requiredScope: 'git:write' })
          .then((auth) => {
            if (!auth?.user) {
              return ctx.reject(['publickey', 'password']);
            }
            authedUser = auth.user;
            ctx.accept();
          })
          .catch(() => ctx.reject(['publickey', 'password']));
        return;
      }

      if (ctx.method === 'none') {
        ctx.reject(['publickey', 'password']);
        return;
      }

      ctx.reject(['publickey', 'password']);
    });

    client.on('session', (accept) => {
      const session = accept();
      session.on('exec', (acceptExec, _rejectExec, info) => {
        const stream = acceptExec();
        handleGitExec(authedUser, info.command, stream).catch((err) => {
          captureException(err, { transport: 'git-ssh', command: info.command });
          stream.stderr.write(`${err.message || 'Internal error'}\n`);
          stream.exit(1);
        });
      });
    });
  });

  server.listen(port, '0.0.0.0', () => {
    const user = process.env.SSH_GIT_USER || 'git';
    console.log(`[git-ssh] listening on port ${port} (user: ${user})`);
  });

  server.on('error', (err) => {
    console.error('[git-ssh] server error:', err.message);
    captureException(err, { transport: 'git-ssh' });
  });

  return server;
}

module.exports = {
  startGitSshServer,
  handleGitExec,
  loadHostKey,
};
