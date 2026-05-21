const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const ALG = 'aes-256-gcm';

function masterKey() {
  const secret =
    process.env.CHAT_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'neuron-dev-chat-key-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
}

function wrapGroupKey(rawKeyBase64) {
  const key = masterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const raw = Buffer.from(rawKeyBase64, 'base64');
  const enc = Buffer.concat([cipher.update(raw), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function unwrapGroupKey(wrapped) {
  if (!wrapped) return null;
  const [ivB64, tagB64, dataB64] = wrapped.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const key = masterKey();
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('base64');
}

function generateGroupKeyBase64() {
  return crypto.randomBytes(32).toString('base64');
}

function isEncryptedPayload(body) {
  return typeof body === 'string' && body.startsWith(PREFIX);
}

module.exports = {
  PREFIX,
  wrapGroupKey,
  unwrapGroupKey,
  generateGroupKeyBase64,
  isEncryptedPayload,
};
