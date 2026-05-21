const test = require('node:test');
const assert = require('node:assert/strict');

test('isWebPushConfigured requires VAPID env trio', () => {
  const prev = {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  };
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  delete require.cache[require.resolve('../utils/webPush')];
  const { isWebPushConfigured } = require('../utils/webPush');
  assert.equal(isWebPushConfigured(), false);

  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:ops@example.com';
  delete require.cache[require.resolve('../utils/webPush')];
  const mod2 = require('../utils/webPush');
  assert.equal(mod2.isWebPushConfigured(), true);

  if (prev.VAPID_PUBLIC_KEY) process.env.VAPID_PUBLIC_KEY = prev.VAPID_PUBLIC_KEY;
  else delete process.env.VAPID_PUBLIC_KEY;
  if (prev.VAPID_PRIVATE_KEY) process.env.VAPID_PRIVATE_KEY = prev.VAPID_PRIVATE_KEY;
  else delete process.env.VAPID_PRIVATE_KEY;
  if (prev.VAPID_SUBJECT) process.env.VAPID_SUBJECT = prev.VAPID_SUBJECT;
  else delete process.env.VAPID_SUBJECT;
});
