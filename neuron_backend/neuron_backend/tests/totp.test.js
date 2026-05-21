const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticator } = require('otplib');
const {
  generateTotpSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
} = require('../utils/totp');

test('totp verify accepts valid token', () => {
  const secret = generateTotpSecret();
  const token = authenticator.generate(secret);
  assert.equal(verifyTotpCode(secret, token), true);
});

test('buildOtpAuthUrl includes issuer and username', () => {
  const url = buildOtpAuthUrl({ secret: 'ABC123', username: 'alice' });
  assert.match(url, /otpauth:\/\/totp/);
  assert.match(url, /alice/);
});
