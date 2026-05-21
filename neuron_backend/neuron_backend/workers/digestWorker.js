/**
 * Send daily digest email from unread notifications.
 * Run: node workers/digestWorker.js
 */
const { loadEnv } = require('../utils/loadEnv');
loadEnv(__dirname);
const { initSentry, captureException } = require('../utils/sentry');
initSentry({ serverName: 'neuron-digest-worker' });
const prisma = require('../utils/prisma');
const { sendEmail, makeUrl } = require('../utils/email');
const { allowsNotificationChannel } = require('../utils/notificationPreferences');

const INTERVAL_MS = Number(process.env.DIGEST_POLL_MS || 60 * 60 * 1000);
const MIN_HOURS_BETWEEN_DIGESTS = Number(process.env.DIGEST_HOURS || 24);

async function processUser(user) {
  if (!user.email || !user.emailVerifiedAt) return;
  if (!allowsNotificationChannel('email', 'digest', user.notificationPreferences)) return;
  const since = user.lastDigestAt || new Date(Date.now() - MIN_HOURS_BETWEEN_DIGESTS * 60 * 60 * 1000);

  const unread = await prisma.notification.findMany({
    where: {
      userId: user.id,
      read: false,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (unread.length === 0) return;

  const lines = unread.map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ''}`).join('\n');
  const inboxUrl = makeUrl('/explore');
  const text = `You have ${unread.length} unread notifications:\n\n${lines}\n\nOpen: ${inboxUrl}`;
  const htmlLines = unread
    .map((n) => `<li><strong>${n.title}</strong>${n.body ? ` — ${n.body}` : ''}</li>`)
    .join('');

  await sendEmail({
    to: user.email,
    subject: `Neuron digest: ${unread.length} updates`,
    text,
    html: `<p>You have ${unread.length} unread notifications:</p><ul>${htmlLines}</ul><p><a href="${inboxUrl}">Open notifications</a></p>`,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastDigestAt: new Date() },
  });
}

async function tick() {
  const users = await prisma.user.findMany({
    where: { email: { not: null }, emailVerifiedAt: { not: null } },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      lastDigestAt: true,
      notificationPreferences: true,
    },
    take: 500,
  });
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    await processUser(user);
  }
}

async function loop() {
  await prisma.$connect();
  console.log('Digest worker started');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await tick();
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop().catch((err) => {
  console.error(err);
  captureException(err, { worker: 'digest' });
  process.exit(1);
});
