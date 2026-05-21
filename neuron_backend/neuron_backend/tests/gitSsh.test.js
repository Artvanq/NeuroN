const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseGitSshCommand,
  normalizePublicKeyLine,
  fingerprintKeyData,
} = require('../utils/gitSshCommand');
const { gitSshRemoteUrl } = require('../utils/gitProject');

test('parseGitSshCommand extracts owner, slug, and service', () => {
  assert.deepEqual(parseGitSshCommand("git-upload-pack 'alice/demo.git'"), {
    type: 'upload-pack',
    owner: 'alice',
    slug: 'demo',
  });
  assert.deepEqual(parseGitSshCommand("git-receive-pack '/bob/app'"), {
    type: 'receive-pack',
    owner: 'bob',
    slug: 'app',
  });
  assert.equal(parseGitSshCommand('git-upload-pack'), null);
});

test('normalizePublicKeyLine parses ssh-ed25519 keys', () => {
  const parsed = normalizePublicKeyLine(
    'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAaAbBcCdDeEfFgGhHiIjJkKlMmNnOoPp neuron@laptop'
  );
  assert.ok(parsed);
  assert.equal(parsed.algo, 'ssh-ed25519');
  assert.ok(parsed.keyData.length > 0);
});

test('fingerprintKeyData is stable SHA256 prefix', () => {
  const data = Buffer.from('test-key');
  const fp = fingerprintKeyData(data);
  assert.match(fp, /^SHA256:/);
  assert.equal(fp, fingerprintKeyData(data));
});

test('gitSshRemoteUrl includes port when not 22', () => {
  const prevHost = process.env.SSH_GIT_HOST;
  const prevPort = process.env.SSH_GIT_PORT;
  process.env.SSH_GIT_HOST = 'git.neuron.test';
  process.env.SSH_GIT_PORT = '2222';
  assert.equal(gitSshRemoteUrl('alice', 'demo'), 'ssh://git@git.neuron.test:2222/alice/demo.git');
  process.env.SSH_GIT_HOST = prevHost;
  process.env.SSH_GIT_PORT = prevPort;
});
