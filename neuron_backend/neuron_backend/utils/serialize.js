function sameId(a, b) {
  if (a == null || b == null) return false;
  const left = typeof a === 'object' ? a._id || a.id : a;
  const right = typeof b === 'object' ? b._id || b.id : b;
  return String(left) === String(right);
}

function pickCategory(c, extras = {}) {
  if (!c) return null;
  return {
    _id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    rules: c.rules || '',
    icon: c.icon,
    color: c.color,
    createdAt: c.createdAt,
    createdBy: extras.createdBy ?? (c.createdBy ? pickAuthor(c.createdBy) : null),
    isUserCommunity: Boolean(c.createdById || extras.isUserCommunity),
    moderatorCount: extras.moderatorCount ?? c._count?.moderators,
    isCategoryModerator: extras.isCategoryModerator,
    canManageCategory: extras.canManageCategory,
  };
}

function pickAuthor(u) {
  if (!u) return null;
  const out = {
    _id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl || null,
    profileUrl: u.profileUrl || null,
    equals(other) {
      return sameId(out._id, other);
    },
  };
  if (u.mindStatement !== undefined) out.mindStatement = u.mindStatement;
  return out;
}

function pickUserPublic(u) {
  if (!u) return null;
  const out = {
    _id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl || null,
    profileUrl: u.profileUrl || null,
    mindStatement: u.mindStatement,
    onboardingCompleted: u.onboardingCompleted,
    isBanned: Boolean(u.isBanned),
    bannedReason: u.bannedReason || '',
    bannedAt: u.bannedAt || null,
    contentLocale: u.contentLocale || 'original',
    createdAt: u.createdAt,
    interestedCategories: (u.interestedCategories || []).map(pickCategory),
  };
  if (u.oauthAccounts) {
    out.linkedProviders = u.oauthAccounts.map((a) => a.provider.toLowerCase());
  }
  return out;
}

function pickUserAuth(u) {
  if (!u) return null;
  const out = pickUserPublic(u);
  delete out.interestedCategories;
  return out;
}

function enrichMutable(doc, saveFn) {
  const base = { ...doc };
  base.equals = (other) => sameId(base._id, other);
  base.save = saveFn;
  base.toObject = () => ({ ...base });
  return base;
}

function formatThread(t, { includeMind, poll, crosspostOf } = {}) {
  if (!t) return null;
  const authorSelect = includeMind ? pickAuthor : (u) => {
    const a = pickAuthor(u);
    if (a) delete a.mindStatement;
    return a;
  };
  const out = {
    _id: t.id,
    title: t.title,
    body: t.body,
    replyCount: t.replyCount,
    score: t.score ?? 0,
    createdAt: t.createdAt,
    author: authorSelect(t.author),
    category: pickCategory(t.category),
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
    isLocked: Boolean(t.isLocked),
    isPinned: Boolean(t.isPinned),
  };
  if (t.authorId) out.authorId = t.authorId;
  if (t.categoryId) out.categoryId = t.categoryId;
  if (t.crosspostOfThreadId) out.crosspostOfThreadId = t.crosspostOfThreadId;
  const src = crosspostOf ?? t.crosspostOf;
  if (src) {
    out.crosspostOf = {
      _id: src.id,
      title: src.title,
      author: pickAuthor(src.author),
      category: pickCategory(src.category),
    };
  }
  if (poll !== undefined) {
    out.poll = poll;
  } else if (t.poll === null) {
    out.poll = null;
  } else if (t.poll?.id) {
    out.hasPoll = true;
  }
  if (Array.isArray(t.inquiries)) {
    out.inquiries = t.inquiries
      .map((ti) => ti.inquiry || ti)
      .filter(Boolean)
      .map((i) => ({ _id: i.id, slug: i.slug, name: i.name }));
  }
  return out;
}

function formatReply(r) {
  if (!r) return null;
  return {
    _id: r.id,
    thread: r.threadId,
    body: r.body,
    score: r.score ?? 0,
    author: pickAuthor(r.author),
    parentReply: r.parentReplyId,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    createdAt: r.createdAt,
  };
}

function formatSynthesis(s) {
  if (!s) return null;
  return {
    _id: s.id,
    thread: s.threadId,
    content: s.content,
    contributors: (s.contributors || []).map(pickAuthor),
    updatedAt: s.updatedAt,
  };
}

function formatConversation(c) {
  if (!c) return null;
  return {
    _id: c.id,
    type: c.type || 'DM',
    name: c.name || null,
    participants: (c.participants || []).map(pickAuthor),
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    encrypted: Boolean(c.groupKeyEnc),
  };
}

function formatMessageReaction(r) {
  if (!r) return null;
  return {
    _id: r.id,
    emoji: r.emoji,
    user: pickAuthor(r.user),
    createdAt: r.createdAt,
  };
}

function formatMessage(m) {
  if (!m) return null;
  const deleted = Boolean(m.deletedAt);
  return {
    _id: m.id,
    conversation: m.conversationId,
    sender: pickAuthor(m.sender),
    body: deleted ? '' : m.body,
    deleted,
    editedAt: m.editedAt || null,
    attachments: deleted ? [] : Array.isArray(m.attachments) ? m.attachments : [],
    reactions: (m.reactions || []).map(formatMessageReaction),
    encrypted: m.encrypted !== false,
    createdAt: m.createdAt,
  };
}

function formatNotification(n) {
  if (!n) return null;
  return {
    _id: n.id,
    user: n.userId,
    type: n.type,
    read: n.read,
    title: n.title,
    body: n.body,
    link: n.link,
    actor: n.actor ? pickAuthor(n.actor) : null,
    createdAt: n.createdAt,
  };
}

function formatReport(r) {
  if (!r) return null;
  return {
    _id: r.id,
    reporter: r.reporter ? pickAuthor(r.reporter) : r.reporterId,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
  };
}

module.exports = {
  sameId,
  pickCategory,
  pickAuthor,
  pickUserPublic,
  pickUserAuth,
  enrichMutable,
  formatThread,
  formatReply,
  formatSynthesis,
  formatConversation,
  formatMessage,
  formatMessageReaction,
  formatNotification,
  formatReport,
};
