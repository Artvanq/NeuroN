const webpush = require('web-push');
const prisma = require('./prisma');
const { allowsNotificationChannel } = require('./notificationPreferences');

let vapidReady = false;

function isWebPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function ensureVapid() {
  if (!isWebPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidReady = true;
  }
  return true;
}

function subscriptionPayload(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function sendWebPushToUser({ userId, type, title, body, link }) {
  if (!ensureVapid()) return { sent: 0, failed: 0 };

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { notificationPreferences: true },
  });
  if (!allowsNotificationChannel('push', type, user?.notificationPreferences)) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const rows = await prisma.pushSubscription.findMany({
    where: { userId: String(userId) },
  });
  if (!rows.length) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({
    title: title || 'Neuron',
    body: body || '',
    url: link || '/',
  });

  let sent = 0;
  let failed = 0;
  const staleIds = [];

  for (const row of rows) {
    try {
      await webpush.sendNotification(subscriptionPayload(row), payload);
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = err?.statusCode || err?.status;
      if (status === 404 || status === 410) {
        staleIds.push(row.id);
      } else {
        console.warn('[webPush] send failed:', err.message);
      }
    }
  }

  if (staleIds.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }

  return { sent, failed };
}

module.exports = {
  isWebPushConfigured,
  getVapidPublicKey,
  sendWebPushToUser,
};
