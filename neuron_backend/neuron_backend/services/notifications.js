const prisma = require('../utils/prisma');
const { formatNotification } = require('../utils/serialize');

const NOTIFICATION_INCLUDE = { actor: true };

async function listNotifications({ userId, unreadOnly = false, limit = 30 }) {
  const where = { userId: String(userId) };
  if (unreadOnly) where.read = false;

  const rows = await prisma.notification.findMany({
    where,
    include: NOTIFICATION_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 30, 1), 100),
  });
  return rows.map(formatNotification);
}

async function countUnreadNotifications(userId) {
  return prisma.notification.count({
    where: { userId: String(userId), read: false },
  });
}

async function markAllNotificationsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId: String(userId), read: false },
    data: { read: true },
  });
}

async function markNotificationRead({ notificationId, userId }) {
  const row = await prisma.notification.findFirst({
    where: { id: String(notificationId), userId: String(userId) },
    include: NOTIFICATION_INCLUDE,
  });
  if (!row) return null;

  const updated = await prisma.notification.update({
    where: { id: row.id },
    data: { read: true },
    include: NOTIFICATION_INCLUDE,
  });
  return formatNotification(updated);
}

async function createNotificationRecord({ userId, type, title, body, link, actorId }) {
  const row = await prisma.notification.create({
    data: {
      userId: String(userId),
      type,
      title,
      body: body || '',
      link: link || '',
      actorId: actorId ? String(actorId) : null,
    },
    include: NOTIFICATION_INCLUDE,
  });
  return formatNotification(row);
}

module.exports = {
  listNotifications,
  countUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  createNotificationRecord,
};
