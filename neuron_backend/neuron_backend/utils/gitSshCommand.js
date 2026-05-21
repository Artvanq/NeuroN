const crypto = require('crypto');

function parseGitSshCommand(command) {
  const trimmed = String(command || '').trim();
  const match = trimmed.match(/^git-(upload-pack|receive-pack)\s+'([^']+)'$/);
  if (!match) return null;

  let repoPath = match[2].replace(/^\/+/, '').replace(/\.git$/i, '');
  const segments = repoPath.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const slug = segments.pop();
  const owner = segments.pop();
  if (!owner || !slug) return null;

  return {
    type: match[1],
    owner: owner.toLowerCase(),
    slug: slug.toLowerCase(),
  };
}

function fingerprintKeyData(keyData) {
  const digest = crypto.createHash('sha256').update(keyData).digest('base64');
  return `SHA256:${digest.replace(/=+$/, '')}`;
}

function normalizePublicKeyLine(input) {
  const line = String(input || '')
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  if (!line) return null;

  const parts = line.split(/\s+/);
  if (parts.length < 2) return null;
  const [algo, body] = parts;
  if (!/^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)$/.test(algo)) {
    return null;
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) return null;

  const comment = parts.slice(2).join(' ') || 'neuron';
  return {
    algo,
    body,
    opensshLine: `${algo} ${body} ${comment}`.trim(),
    keyData: Buffer.from(body, 'base64'),
  };
}

module.exports = {
  parseGitSshCommand,
  fingerprintKeyData,
  normalizePublicKeyLine,
};
