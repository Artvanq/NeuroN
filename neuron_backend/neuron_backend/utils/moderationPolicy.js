function parseCsv(raw) {
  return String(raw || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function getModerationPolicy() {
  const allowedTargets = unique([
    'thread',
    'reply',
    'user',
    'message',
    'project',
    'file',
    ...parseCsv(process.env.MOD_ALLOWED_TARGETS),
  ]);
  const allowedStatuses = unique([
    'reviewed',
    'dismissed',
    'actioned',
    ...parseCsv(process.env.MOD_ALLOWED_STATUSES),
  ]);
  const allowedActions = unique([
    'none',
    'content_removed',
    'user_banned',
    'user_unbanned',
    'warning_sent',
    'appeal_accepted',
    'appeal_rejected',
    ...parseCsv(process.env.MOD_ALLOWED_ACTIONS),
  ]);

  return {
    allowedTargets,
    allowedStatuses,
    allowedActions,
  };
}

module.exports = {
  getModerationPolicy,
};
