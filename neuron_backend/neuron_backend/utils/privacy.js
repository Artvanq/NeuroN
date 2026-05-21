const prisma = require('./prisma');

async function getBlockStatus(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) {
    return { blocked: false, blockedBy: false };
  }
  const [blocked, blockedBy] = await Promise.all([
    prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: viewerId, blockedId: targetId } },
    }),
    prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: targetId, blockedId: viewerId } },
    }),
  ]);
  return { blocked: Boolean(blocked), blockedBy: Boolean(blockedBy) };
}

async function hasExistingDm(userA, userB) {
  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'DM',
      AND: [
        { participants: { some: { id: userA } } },
        { participants: { some: { id: userB } } },
      ],
    },
    select: { id: true, participants: true },
  });
  return conversations.some((c) => c.participants.length === 2);
}

async function hasAcceptedMessageAccess(fromUserId, toUserId) {
  const accepted = await prisma.messageRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    },
  });
  return Boolean(accepted);
}

async function getPendingRequest(fromUserId, toUserId) {
  return prisma.messageRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
  });
}

/**
 * Can viewer see questions / mind statement on profile?
 */
async function canViewProfileContent(viewerId, targetUser) {
  if (!targetUser) return false;
  if (viewerId && viewerId === targetUser.id) return true;

  const { blocked, blockedBy } = await getBlockStatus(viewerId, targetUser.id);
  if (blocked || blockedBy) return false;

  if (targetUser.profileVisibility === 'CLOSED') {
    return false;
  }

  return true;
}

/**
 * Can viewer start or open DM with target?
 */
async function canMessageUser(viewerId, targetUser) {
  if (!viewerId) {
    return { ok: false, code: 'login_required', message: 'Sign in to send messages' };
  }
  if (!targetUser) {
    return { ok: false, code: 'not_found', message: 'User not found' };
  }
  if (viewerId === targetUser.id) {
    return { ok: false, code: 'self', message: 'Cannot message yourself' };
  }

  const { blocked, blockedBy } = await getBlockStatus(viewerId, targetUser.id);
  if (blocked) {
    return { ok: false, code: 'blocked', message: 'You blocked this user' };
  }
  if (blockedBy) {
    return { ok: false, code: 'blocked_by', message: 'This user has restricted contact with you' };
  }

  if (targetUser.profileVisibility === 'CLOSED') {
    return { ok: false, code: 'closed', message: 'This profile does not accept messages' };
  }

  const dmExists = await hasExistingDm(viewerId, targetUser.id);
  if (dmExists) {
    return { ok: true, code: 'existing_dm' };
  }

  if (targetUser.profileVisibility === 'OPEN') {
    return { ok: true, code: 'open' };
  }

  if (targetUser.profileVisibility === 'REQUEST') {
    const accepted = await hasAcceptedMessageAccess(viewerId, targetUser.id);
    if (accepted) {
      return { ok: true, code: 'accepted_request' };
    }
    const pending = await getPendingRequest(viewerId, targetUser.id);
    if (pending?.status === 'PENDING') {
      return {
        ok: false,
        code: 'request_pending',
        message: 'Message request already sent',
      };
    }
    return {
      ok: false,
      code: 'request_required',
      message: 'Send a message request first',
    };
  }

  return { ok: false, code: 'denied', message: 'Messaging not allowed' };
}

async function buildProfileAccess(viewerId, targetUser) {
  const isSelf = viewerId && viewerId === targetUser.id;
  const { blocked, blockedBy } = await getBlockStatus(viewerId, targetUser.id);
  const canViewContent = await canViewProfileContent(viewerId, targetUser);
  const messageAccess = await canMessageUser(viewerId, targetUser);

  let pendingRequest = null;
  if (viewerId && !isSelf && targetUser.profileVisibility === 'REQUEST') {
    pendingRequest = await getPendingRequest(viewerId, targetUser.id);
  }

  return {
    profileVisibility: targetUser.profileVisibility,
    isSelf,
    blocked,
    blockedBy,
    canViewContent,
    canMessage: messageAccess.ok,
    messageAccessCode: messageAccess.code,
    messageAccessMessage: messageAccess.message || null,
    hasPendingRequest: pendingRequest?.status === 'PENDING',
    requestDeclined: pendingRequest?.status === 'DECLINED',
  };
}

module.exports = {
  getBlockStatus,
  canViewProfileContent,
  canMessageUser,
  hasExistingDm,
  hasAcceptedMessageAccess,
  getPendingRequest,
  buildProfileAccess,
};
