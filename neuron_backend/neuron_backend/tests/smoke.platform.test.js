const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAttachments } = require('../utils/attachments');
const { permissionsForRole } = require('../utils/projectAccess');
const { verifyTotpCode, generateTotpSecret } = require('../utils/totp');
const { authenticator } = require('otplib');

test('platform smoke: core utils compose without throw', () => {
  const attachments = normalizeAttachments([{ url: 'https://x.test/a.png' }]);
  assert.equal(attachments.length, 1);
  assert.equal(permissionsForRole('OWNER').admin, true);

  const secret = generateTotpSecret();
  const token = authenticator.generate(secret);
  assert.equal(verifyTotpCode(secret, token), true);
});
