const express = require('express');
const userService = require('../services/users');
const projectService = require('../services/projects');
const asyncHandler = require('../middleware/asyncHandler');
const { optionalAuth } = require('../middleware/auth');
const escapeRegex = require('../utils/escapeRegex');
const prisma = require('../utils/prisma');
const { findThreadsPaginated } = require('../utils/threadPaginate');
const { searchThreadsFts } = require('../utils/threadFts');
const { formatOrganization } = require('../utils/orgAccess');

const router = express.Router();

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ threads: [], users: [], projects: [], organizations: [], messages: [] });
    }

    const safe = escapeRegex(q);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 40);
    const { cursor } = req.query;
    const regex = new RegExp(safe, 'i');

    let threads = [];
    let nextCursor = null;
    try {
      threads = await searchThreadsFts(q, { limit });
    } catch {
      const page = await findThreadsPaginated(
        {
          $or: [{ title: { $regex: regex } }, { body: { $regex: regex } }],
        },
        { sort: req.query.sort || 'top', limit, cursor }
      );
      threads = page.threads;
      nextCursor = page.nextCursor;
    }

    const term = q.toLowerCase();
    const [users, projects, orgRows, messages] = await Promise.all([
      userService.searchUsers({ query: q, limit: 10 }),
      projectService.searchProjects({ query: q, limit: 10, userId: req.user?._id }),
      prisma.organization.findMany({
        where: {
          OR: [
            { slug: { contains: term } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { _count: { select: { members: true, projects: true } } },
      }),
      req.user?._id
        ? prisma.message.findMany({
            where: {
              deletedAt: null,
              body: { contains: q, mode: 'insensitive' },
              conversation: {
                participants: {
                  some: { userId: req.user._id },
                },
              },
            },
            include: {
              sender: { select: { id: true, username: true, displayName: true } },
              conversation: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                  participants: {
                    select: {
                      user: { select: { username: true, displayName: true } },
                    },
                    take: 3,
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    const organizations = orgRows.map((o) =>
      formatOrganization(o, {
        memberCount: o._count.members,
        projectCount: o._count.projects,
      })
    );

    res.json({
      threads,
      users,
      projects,
      organizations,
      messages: messages.map((m) => ({
        _id: m.id,
        body: String(m.body || '').slice(0, 180),
        createdAt: m.createdAt,
        sender: m.sender
          ? {
              _id: m.sender.id,
              username: m.sender.username,
              displayName: m.sender.displayName,
            }
          : null,
        conversation: {
          _id: m.conversation.id,
          type: m.conversation.type,
          name: m.conversation.name,
          participants: (m.conversation.participants || [])
            .map((p) => p.user)
            .filter(Boolean),
        },
      })),
      nextCursor,
      query: q,
    });
  })
);

module.exports = router;
