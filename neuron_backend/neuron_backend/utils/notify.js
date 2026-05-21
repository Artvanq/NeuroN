const prisma = require('./prisma');
const notificationService = require('../services/notifications');
const { sendNotificationEmail } = require('./notificationEmail');
const { sendWebPushToUser } = require('./webPush');
const { allowsNotificationChannel } = require('./notificationPreferences');

let io = null;

function setSocketIO(socketServer) {
  io = socketServer;
}

async function createNotification({ userId, type, title, body, link, actorId }) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { notificationPreferences: true },
  });
  if (!allowsNotificationChannel('inApp', type, user?.notificationPreferences)) {
    return null;
  }

  const doc = await notificationService.createNotificationRecord({
    userId,
    type,
    title,
    body,
    link,
    actorId,
  });

  if (io) {
    io.to(`user:${String(userId)}`).emit('notification', doc);
  }

  sendNotificationEmail({ userId, type, title, body, link }).catch((err) => {
    console.warn('[notify] email failed:', err.message);
  });

  sendWebPushToUser({ userId, type, title, body, link }).catch((err) => {
    console.warn('[notify] web push failed:', err.message);
  });

  return doc;
}

module.exports = { setSocketIO, createNotification };
