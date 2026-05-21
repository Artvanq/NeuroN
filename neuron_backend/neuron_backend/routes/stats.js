const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireSiteOwner } = require('../utils/siteOwner');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireSiteOwner);

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const since7 = daysAgo(7);
    const since30 = daysAgo(30);
    const since24h = daysAgo(1);

    const [
      totalUsers,
      newUsers24h,
      newUsers7d,
      totalThreads,
      totalReplies,
      totalMessages,
      dmChats,
      groupChats,
      totalCategories,
      active7d,
      active30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since24h } } }),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.thread.count(),
      prisma.reply.count(),
      prisma.message.count(),
      prisma.conversation.count({ where: { type: 'DM' } }),
      prisma.conversation.count({ where: { type: 'GROUP' } }),
      prisma.category.count(),
      activeUserCount(since7),
      activeUserCount(since30),
    ]);

    res.json({
      users: {
        total: totalUsers,
        new24h: newUsers24h,
        new7d: newUsers7d,
        active7d,
        active30d,
      },
      content: {
        threads: totalThreads,
        replies: totalReplies,
      },
      messaging: {
        messages: totalMessages,
        dmChats,
        groupChats,
        totalChats: dmChats + groupChats,
      },
      categories: totalCategories,
      generatedAt: new Date().toISOString(),
    });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const sort = req.query.sort === 'registered' ? 'registered' : 'activity';

    const orderClause =
      sort === 'registered'
        ? 'u.created_at DESC'
        : 'last_activity_at DESC NULLS LAST, u.created_at DESC';

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        u.id,
        u.username,
        u.display_name AS "displayName",
        u.created_at AS "createdAt",
        u.onboarding_completed AS "onboardingCompleted",
        (SELECT COUNT(*)::int FROM threads t WHERE t.author_id = u.id) AS "threadsCount",
        (SELECT COUNT(*)::int FROM replies r WHERE r.author_id = u.id) AS "repliesCount",
        (SELECT COUNT(*)::int FROM messages m WHERE m.sender_id = u.id) AS "messagesCount",
        (SELECT COUNT(*)::int FROM votes v WHERE v.user_id = u.id) AS "votesCount",
        (SELECT COUNT(*)::int FROM conversation_members cm WHERE cm.user_id = u.id) AS "chatsJoined",
        GREATEST(
          COALESCE((SELECT MAX(t.created_at) FROM threads t WHERE t.author_id = u.id), to_timestamp(0)),
          COALESCE((SELECT MAX(r.created_at) FROM replies r WHERE r.author_id = u.id), to_timestamp(0)),
          COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.sender_id = u.id), to_timestamp(0))
        ) AS "lastActivityAt"
      FROM users u
      ORDER BY ${orderClause}
      LIMIT $1 OFFSET $2
      `,
      limit,
      offset
    );

    const [{ count: total }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM users`;

    res.json({
      users: rows.map((row) => {
        const threadsCount = Number(row.threadsCount) || 0;
        const repliesCount = Number(row.repliesCount) || 0;
        const messagesCount = Number(row.messagesCount) || 0;
        const votesCount = Number(row.votesCount) || 0;
        const chatsJoined = Number(row.chatsJoined) || 0;
        return {
          id: row.id,
          username: row.username,
          displayName: row.displayName,
          createdAt: row.createdAt,
          onboardingCompleted: row.onboardingCompleted,
          threadsCount,
          repliesCount,
          messagesCount,
          votesCount,
          chatsJoined,
          activityScore: threadsCount + repliesCount + messagesCount + votesCount,
          lastActivityAt:
            row.lastActivityAt && new Date(row.lastActivityAt).getTime() > 0
              ? row.lastActivityAt
              : null,
        };
      }),
      pagination: { total, limit, offset },
    });
  })
);

async function activeUserCount(since) {
  const [{ count }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM (
      SELECT author_id AS uid FROM threads WHERE created_at >= ${since}
      UNION
      SELECT author_id FROM replies WHERE created_at >= ${since}
      UNION
      SELECT sender_id FROM messages WHERE created_at >= ${since}
    ) active_users
  `;
  return count;
}

module.exports = router;
