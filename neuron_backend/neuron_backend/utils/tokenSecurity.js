const crypto = require('crypto');

function createRawToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

module.exports = {
  createRawToken,
  hashToken,
};
