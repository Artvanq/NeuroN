const NOTIFICATION_TYPES = [
  'reply',
  'vote',
  'message',
  'message_request',
  'message_request_accepted',
  'message_request_declined',
  'project_pr_opened',
  'project_pr_review',
  'project_issue_opened',
  'project_issue_comment',
  'project_ci_success',
  'project_ci_failure',
  'synthesis_update',
  'moderation_warning',
];

const CHANNELS = ['inApp', 'email', 'push'];

function defaultChannelMap() {
  return NOTIFICATION_TYPES.reduce((acc, type) => {
    acc[type] = true;
    return acc;
  }, { digest: true });
}

function getDefaultNotificationPreferences() {
  return {
    inApp: defaultChannelMap(),
    email: defaultChannelMap(),
    push: defaultChannelMap(),
  };
}

function normalizeNotificationPreferences(raw) {
  const base = getDefaultNotificationPreferences();
  if (!raw || typeof raw !== 'object') return base;

  for (const channel of CHANNELS) {
    const source = raw[channel];
    if (!source || typeof source !== 'object') continue;
    for (const type of NOTIFICATION_TYPES) {
      if (typeof source[type] === 'boolean') {
        base[channel][type] = source[type];
      }
    }
    if (typeof source.digest === 'boolean') {
      base[channel].digest = source.digest;
    }
  }

  return base;
}

function allowsNotificationChannel(channel, type, preferences) {
  const prefs = normalizeNotificationPreferences(preferences);
  const channelMap = prefs[channel] || {};
  if (type === 'digest') {
    return channelMap.digest !== false;
  }
  if (!NOTIFICATION_TYPES.includes(type)) return true;
  return channelMap[type] !== false;
}

module.exports = {
  NOTIFICATION_TYPES,
  CHANNELS,
  getDefaultNotificationPreferences,
  normalizeNotificationPreferences,
  allowsNotificationChannel,
};
