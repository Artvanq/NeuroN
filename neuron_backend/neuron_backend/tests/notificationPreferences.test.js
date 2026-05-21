const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getDefaultNotificationPreferences,
  normalizeNotificationPreferences,
  allowsNotificationChannel,
} = require('../utils/notificationPreferences');

test('normalizeNotificationPreferences fills defaults', () => {
  const prefs = normalizeNotificationPreferences({
    inApp: { reply: false },
    email: { digest: false },
    push: { message: false },
  });
  assert.equal(prefs.inApp.reply, false);
  assert.equal(prefs.inApp.message, true);
  assert.equal(prefs.email.digest, false);
  assert.equal(prefs.push.message, false);
  assert.equal(prefs.push.reply, true);
});

test('allowsNotificationChannel respects per-type toggles', () => {
  const prefs = { inApp: { reply: false }, email: { message: false } };
  assert.equal(allowsNotificationChannel('inApp', 'reply', prefs), false);
  assert.equal(allowsNotificationChannel('inApp', 'message', prefs), true);
  assert.equal(allowsNotificationChannel('email', 'message', prefs), false);
  assert.equal(allowsNotificationChannel('email', 'digest', { email: { digest: false } }), false);
});

test('getDefaultNotificationPreferences enables all channels', () => {
  const prefs = getDefaultNotificationPreferences();
  assert.equal(allowsNotificationChannel('inApp', 'project_pr_opened', prefs), true);
  assert.equal(allowsNotificationChannel('email', 'moderation_warning', prefs), true);
  assert.equal(allowsNotificationChannel('push', 'message', prefs), true);
});
