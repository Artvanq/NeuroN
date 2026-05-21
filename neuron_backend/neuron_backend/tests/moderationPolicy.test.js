const test = require('node:test');
const assert = require('node:assert/strict');

test('getModerationPolicy includes defaults and env extras', () => {
  const original = {
    MOD_ALLOWED_TARGETS: process.env.MOD_ALLOWED_TARGETS,
    MOD_ALLOWED_STATUSES: process.env.MOD_ALLOWED_STATUSES,
    MOD_ALLOWED_ACTIONS: process.env.MOD_ALLOWED_ACTIONS,
  };
  process.env.MOD_ALLOWED_TARGETS = 'comment,thread';
  process.env.MOD_ALLOWED_STATUSES = 'escalated,actioned';
  process.env.MOD_ALLOWED_ACTIONS = 'mute_user,user_banned';

  delete require.cache[require.resolve('../utils/moderationPolicy')];
  const { getModerationPolicy } = require('../utils/moderationPolicy');
  const policy = getModerationPolicy();

  assert.equal(policy.allowedTargets.includes('thread'), true);
  assert.equal(policy.allowedTargets.includes('comment'), true);
  assert.equal(policy.allowedStatuses.includes('reviewed'), true);
  assert.equal(policy.allowedStatuses.includes('escalated'), true);
  assert.equal(policy.allowedActions.includes('none'), true);
  assert.equal(policy.allowedActions.includes('mute_user'), true);

  process.env.MOD_ALLOWED_TARGETS = original.MOD_ALLOWED_TARGETS;
  process.env.MOD_ALLOWED_STATUSES = original.MOD_ALLOWED_STATUSES;
  process.env.MOD_ALLOWED_ACTIONS = original.MOD_ALLOWED_ACTIONS;
  delete require.cache[require.resolve('../utils/moderationPolicy')];
});
