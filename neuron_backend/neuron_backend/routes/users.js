const express = require('express');
const userService = require('../services/users');
const prisma = require('../utils/prisma');
const { optionalAuth } = require('../middleware/auth');
const { buildProfileAccess, canViewProfileContent } = require('../utils/privacy');
const asyncHandler = require('../middleware/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { findThreadsPaginated } = require('../utils/threadPaginate');
const { pickUserPublic } = require('../utils/serialize');
const { requireAuth } = require('../middleware/auth');
const {
  findCompatibleMinds,
  findRecommendedThreads,
} = require('../utils/recommendations');

const router = express.Router();

router.get(
  '/recommendations/minds',
  requireAuth,
  asyncHandler(async (req, res) => {
    const minds = await findCompatibleMinds(req.user._id, {
      limit: parseInt(req.query.limit, 10) || 8,
    });
    res.json({ minds });
  })
);

router.get(
  '/recommendations/threads',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit = '12', cursor } = req.query;
    const result = await findRecommendedThreads(req.user._id, { limit, cursor });
    res.json(result);
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const safe = escapeRegex(q);
    const users = await userService.searchUsersByUsername({ query: q, limit: 20 });

    res.json(users);
  })
);

router.get(
  '/:username/projects',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = await userService.findUserIdByUsername(req.params.username);
    if (!userId) return res.status(404).json({ message: 'User not found' });

    const targetRow = await prisma.user.findUnique({ where: { id: userId } });
    const canView = await canViewProfileContent(req.user?._id, targetRow);
    if (!canView) return res.json({ projects: [] });

    const rows = await prisma.project.findMany({
      where: { ownerId: userId },
      include: { owner: true, category: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const projects = await Promise.all(
      rows.map(async (p) => {
        const openIssueCount = await prisma.issue.count({
          where: { projectId: p.id, status: 'open' },
        });
        const openPullCount = await prisma.pullRequest.count({
          where: { projectId: p.id, status: 'open' },
        });
        return {
          owner: p.owner.username,
          slug: p.slug,
          name: p.name,
          description: p.description,
          openIssueCount,
          openPullCount,
          updatedAt: p.updatedAt,
        };
      })
    );

    res.json({ projects });
  })
);

router.get(
  '/:username/threads',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = await userService.findUserIdByUsername(req.params.username);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetRow = await prisma.user.findUnique({ where: { id: userId } });
    const canView = await canViewProfileContent(req.user?._id, targetRow);
    if (!canView) {
      return res.json({ threads: [], nextCursor: null, hasMore: false });
    }

    const { limit = '20', cursor, q } = req.query;
    const filter = { author: userId };
    const query = String(q || '').trim();
    if (query.length >= 2) filter.q = query;

    const result = await findThreadsPaginated(filter, {
      sort: req.query.sort || 'new',
      limit,
      cursor,
      viewerUserId: req.user?._id,
    });

    res.json(result);
  })
);

router.get(
  '/:username',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({
      where: { username: req.params.username.toLowerCase() },
      include: { interestedCategories: true, oauthAccounts: true },
    });
    if (!row) {
      return res.status(404).json({ message: 'User not found' });
    }

    const access = await buildProfileAccess(req.user?._id, row);
    const base = pickUserPublic(row);

    if (!access.canViewContent) {
      return res.json({
        ...base,
        mindStatement: '',
        interestedCategories: [],
        access,
      });
    }

    res.json({ ...base, access });
  })
);

module.exports = router;
