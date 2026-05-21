function formatSanction(row, { pendingAppeal = null } = {}) {
  if (!row?.isBanned) return null;
  return {
    isBanned: true,
    reason: row.bannedReason || '',
    bannedAt: row.bannedAt || null,
    canAppeal: true,
    pendingAppeal: pendingAppeal
      ? {
          _id: pendingAppeal.id,
          status: pendingAppeal.status,
          createdAt: pendingAppeal.createdAt,
        }
      : null,
  };
}

function formatBanErrorBody(row) {
  const reason = row?.bannedReason || '';
  return {
    code: 'account_banned',
    message: reason ? `Account is banned: ${reason}` : 'Account is banned',
    bannedReason: reason,
    bannedAt: row?.bannedAt || null,
    canAppeal: true,
    appealUrl: '/sanctions/appeal',
  };
}

module.exports = {
  formatSanction,
  formatBanErrorBody,
};
