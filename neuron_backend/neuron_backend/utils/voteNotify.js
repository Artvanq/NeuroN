const prisma = require('./prisma');
const { createNotification } = require('./notify');

async function notifyVoteAuthor({ voterId, targetType, targetId, scoreDelta }) {
  if (scoreDelta <= 0) return;

  let authorId = null;
  let link = '/explore';
  let title = 'New resonance';

  if (targetType === 'thread') {
    const row = await prisma.thread.findUnique({
      where: { id: String(targetId) },
      select: { authorId: true, title: true },
    });
    if (!row) return;
    authorId = row.authorId;
    link = `/t/${targetId}`;
    title = `Resonance on "${row.title.slice(0, 80)}"`;
  } else if (targetType === 'reply') {
    const row = await prisma.reply.findUnique({
      where: { id: String(targetId) },
      select: { authorId: true, threadId: true },
    });
    if (!row) return;
    authorId = row.authorId;
    link = `/t/${row.threadId}#reply-${targetId}`;
    title = 'Resonance on your response';
  }

  if (!authorId || String(authorId) === String(voterId)) return;

  await createNotification({
    userId: authorId,
    type: 'vote',
    title,
    body: 'Someone upvoted your contribution',
    link,
    actorId: voterId,
  });
}

module.exports = { notifyVoteAuthor };
