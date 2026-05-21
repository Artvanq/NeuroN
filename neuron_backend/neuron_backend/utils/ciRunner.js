const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const prisma = require('./prisma');
const { parseCiConfig } = require('./ciParser');
const { getBranchFiles } = require('./repoFiles');
const { notifyCiResult } = require('./ciNotify');
const logger = require('./logger');

function runCommand(cmd, cwd, log) {
  return new Promise((resolve) => {
    log.push(`$ ${cmd}\n`);
    const child = spawn(cmd, {
      cwd,
      shell: true,
      env: { ...process.env, CI: 'true', NEURON: 'true' },
    });
    child.stdout.on('data', (d) => log.push(d.toString()));
    child.stderr.on('data', (d) => log.push(d.toString()));
    child.on('close', (code) => {
      log.push(`\n[exit ${code}]\n`);
      resolve(code === 0);
    });
    child.on('error', (err) => {
      log.push(`\n[error] ${err.message}\n`);
      resolve(false);
    });
  });
}

async function runWorkflow(projectId, branch, trigger, { pullRequestNumber } = {}) {
  const files = await getBranchFiles(projectId, branch);
  const ciFile = files.find((f) => f.path === '.neuron/ci.yml' || f.path === 'neuron.yml');
  if (!ciFile) {
    return null;
  }

  const config = parseCiConfig(ciFile.content);
  if (!config.triggers.includes(trigger) && trigger !== 'manual') {
    return null;
  }

  const run = await prisma.workflowRun.create({
    data: {
      projectId,
      branch,
      workflowName: config.name,
      trigger: pullRequestNumber ? `pr:${pullRequestNumber}` : trigger,
      status: 'running',
    },
  });

  const log = [`Workflow: ${config.name}`, `Branch: ${branch}`, `Trigger: ${trigger}`, '---\n'];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neuron-ci-'));

  try {
    for (const file of files) {
      const full = path.join(tmpDir, file.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, file.content, 'utf8');
    }

    let ok = true;
    for (const step of config.steps) {
      log.push(`\n## step: ${step}\n`);
      const passed = await runCommand(step, tmpDir, log);
      if (!passed) {
        ok = false;
        break;
      }
    }

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: ok ? 'success' : 'failure',
        logs: log.join(''),
        finishedAt: new Date(),
      },
    });

    await notifyCiResult(projectId, branch, ok ? 'success' : 'failure', config.name);
  } catch (err) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: 'failure',
        logs: `${log.join('')}\n[fatal] ${err.message}`,
        finishedAt: new Date(),
      },
    });
    await notifyCiResult(projectId, branch, 'failure', config.name);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return prisma.workflowRun.findUnique({ where: { id: run.id } });
}

function triggerCi(projectId, branch, trigger, meta = {}) {
  setImmediate(() => {
    runWorkflow(projectId, branch, trigger, meta).catch((err) => {
      logger.error('CI workflow failed', { projectId, branch, error: err.message });
    });
  });
}

module.exports = { runWorkflow, triggerCi, parseCiConfig };
