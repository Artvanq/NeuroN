const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { enqueueAnalytics } = require('../utils/analyticsOutbox');
const { createNotification } = require('../utils/notify');
const { findThreadsPaginated } = require('../utils/threadPaginate');
const { attachMyVotes, getReplyDepth, MAX_REPLY_DEPTH } = require('../utils/votes');
const { formatReply, sameId } = require('../utils/serialize');
const { threadCreateRateLimit, replyCreateRateLimit } = require('../middleware/rateLimit');
const categoryService = require('../services/categories');
const threadService = require('../services/threads');
const replyService = require('../services/replies');
const inquiryService = require('../services/inquiries');
const synthesisService = require('../services/synthesis');
const { resolveUserRole } = require('../utils/rbac');

const router = express.Router();

async function canModerateThread(userId, threadRow) {
  if (!userId || !threadRow) return false;
  if (String(threadRow.authorId) === String(userId)) return true;
  const mod = await prisma.categoryModerator.findUnique({
    where: {
      categoryId_userId: {
        categoryId: threadRow.categoryId,
        userId: String(userId),
      },
    },
  });
  if (mod) return true;
  const user = await prisma.user.findUnique({ where: { id: String(userId) } });
  const role = resolveUserRole(user);
  return role === 'MODERATOR' || role === 'ADMIN';
}

function extractKeywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5)
    .slice(0, 30);
}

async function canParticipateInSynthesis(userId, threadId) {
  const thread = await threadService.getThreadById(threadId);
  if (!thread) return { ok: false, status: 404, message: 'Thread not found' };
  if (sameId(thread.authorId, userId) || sameId(thread.author?._id, userId)) {
    return { ok: true, thread };
  }
  const replied = await replyService.userRepliedOnThread({ threadId, authorId: userId });
  if (replied) return { ok: true, thread };
  return { ok: false, status: 403, message: 'Respond to this question before shaping emergence' };
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const {
      category: categorySlug,
      limit = '20',
      sort: sortParam,
      lens,
      fields,
      cursor,
      q,
    } = req.query;

    const filter = {};
    let sort = sortParam || 'hot';

    if (categorySlug) {
      const category = await categoryService.findCategoryBySlug(categorySlug);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      filter.category = category._id;
    }

    if (fields) {
      const slugs = String(fields)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (slugs.length > 0) {
        const cats = await categoryService.findCategoriesBySlugs(slugs);
        if (cats.length > 0) {
          filter.category = { $in: cats.map((c) => c._id) };
        }
      }
    }

    if (lens === 'seeking') {
      filter.replyCount = { $lt: 3 };
      sort = 'new';
    } else if (lens === 'collision') {
      filter.replyCount = { $gte: 3 };
      sort = 'top';
    } else if (lens === 'recent') {
      sort = 'new';
    } else if (lens === 'for-you' && req.user?._id) {
      const { findRecommendedThreads } = require('../utils/recommendations');
      const result = await findRecommendedThreads(req.user._id, { limit, cursor });
      return res.json(result);
    }

    const query = String(q || '').trim();
    if (query.length >= 2) filter.q = query;

    const result = await findThreadsPaginated(filter, {
      sort,
      limit,
      cursor,
      viewerUserId: req.user?._id,
    });

    res.json(result);
  })
);

router.post(
  '/',
  requireAuth,
  threadCreateRateLimit,
  asyncHandler(async (req, res) => {
    const { title, body, categoryId, categorySlug, attachments, poll: pollBody } = req.body;
    const { normalizeAttachments } = require('../utils/attachments');
    const { createPollForThread, normalizePollOptions } = require('../utils/threadPoll');
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    let category = null;
    if (categoryId) {
      category = await categoryService.findCategoryById(categoryId);
    } else if (categorySlug) {
      category = await categoryService.findCategoryBySlug(categorySlug);
    }
    if (!category) {
      return res.status(400).json({ message: 'Valid category is required' });
    }

    if (pollBody) {
      const check = normalizePollOptions(pollBody.options);
      if (!check.ok) {
        return res.status(400).json({ message: check.message });
      }
    }

    const thread = await threadService.createThread({
      title: title.trim(),
      body: body?.trim() || '',
      attachments: normalizeAttachments(attachments),
      authorId: req.user._id,
      categoryId: category._id,
    });

    if (pollBody?.options) {
      thread.poll = await createPollForThread(thread._id, {
        options: pollBody.options,
        endsAt: pollBody.endsAt,
      });
    }

    const inquirySlugs = Array.isArray(req.body.inquiries)
      ? req.body.inquiries.filter((s) => typeof s === 'string')
      : [];
    if (inquirySlugs.length) {
      thread.inquiries = await inquiryService.setThreadInquiries(
        thread._id,
        inquirySlugs,
        { creatorId: req.user._id }
      );
    } else {
      thread.inquiries = [];
    }

    enqueueAnalytics('post_created', {
      threadId: thread._id,
      authorId: req.user._id,
      categoryId: category._id,
      inquiries: inquirySlugs,
    });

    res.status(201).json(thread);
  })
);

router.get(
  '/:id/inquiries',
  asyncHandler(async (req, res) => {
    const inquiries = await inquiryService.listThreadInquiries(req.params.id);
    res.json(inquiries);
  })
);

router.put(
  '/:id/inquiries',
  requireAuth,
  asyncHandler(async (req, res) => {
    const thread = await prisma.thread.findUnique({ where: { id: String(req.params.id) } });
    if (!thread) return res.status(404).json({ message: 'Thread not found' });
    const canModerate = await canModerateThread(req.user._id, thread);
    if (!canModerate) return res.status(403).json({ message: 'Not allowed' });

    const slugs = Array.isArray(req.body.inquiries)
      ? req.body.inquiries.filter((s) => typeof s === 'string')
      : [];
    const inquiries = await inquiryService.setThreadInquiries(thread.id, slugs, {
      creatorId: req.user._id,
    });
    res.json(inquiries);
  })
);

router.get(
  '/:id/related',
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const related = await threadService.listRelatedThreads({
      threadId: thread._id,
      categoryId: thread.category?._id || thread.categoryId,
      limit: 6,
    });

    res.json(related);
  })
);

router.get(
  '/:id/resonance-candidates',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const thread = await prisma.thread.findUnique({
      where: { id: String(req.params.id) },
      include: { author: true, category: true },
    });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const replyRows = await prisma.reply.findMany({
      where: { threadId: thread.id },
      select: { authorId: true },
      take: 100,
    });
    const participantIds = new Set([thread.authorId, ...replyRows.map((r) => r.authorId)]);
    if (req.user?._id) participantIds.add(String(req.user._id));

    const baseCandidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(participantIds) },
        interestedCategories: { some: { id: thread.categoryId } },
      },
      include: { interestedCategories: true },
      take: 30,
    });

    const keywords = new Set(extractKeywords(`${thread.title} ${thread.body || ''}`));

    const scored = baseCandidates
      .map((u) => {
        let score = 4;
        const statement = String(u.mindStatement || '').toLowerCase();
        for (const kw of keywords) {
          if (statement.includes(kw)) score += 2;
        }
        if (u.onboardingCompleted) score += 1;
        return { user: u, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(req.query.limit, 10) || 8)
      .map(({ user, score }) => ({
        _id: user.id,
        username: user.username,
        displayName: user.displayName,
        mindStatement: user.mindStatement || '',
        score,
      }));

    res.json({ minds: scored });
  })
);

router.get(
  '/:id/synthesis',
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const synthesis = await synthesisService.findSynthesisByThread(thread._id);
    if (!synthesis) {
      return res.json({
        thread: thread._id,
        content: '',
        contributors: [],
        updatedAt: null,
      });
    }

    res.json(synthesis);
  })
);

router.put(
  '/:id/synthesis',
  requireAuth,
  asyncHandler(async (req, res) => {
    const check = await canParticipateInSynthesis(req.user._id, req.params.id);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ message: 'content is required' });
    }

    const trimmed = String(content).trim().slice(0, 8000);
    const synthesis = await synthesisService.upsertSynthesisContent({
      threadId: check.thread._id,
      content: trimmed,
      contributorId: req.user._id,
    });

    for (const contributor of synthesis.contributors || []) {
      const cid = contributor._id || contributor.id;
      if (!cid || String(cid) === String(req.user._id)) continue;
      await createNotification({
        userId: cid,
        type: 'synthesis_update',
        title: 'Synthesis updated',
        body: `${req.user.username} updated shared emergence`,
        link: `/t/${check.thread._id}`,
        actorId: req.user._id,
      });
    }

    res.json(synthesis);
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.thread.findUnique({ where: { id: String(req.params.id) } });
    if (!row) return res.status(404).json({ message: 'Thread not found' });

    const data = {};
    if (req.body.isLocked !== undefined) {
      const ok = await canModerateThread(req.user._id, row);
      if (!ok) return res.status(403).json({ message: 'Not allowed to lock this thread' });
      data.isLocked = Boolean(req.body.isLocked);
    }
    if (req.body.isPinned !== undefined) {
      const ok = await canModerateThread(req.user._id, row);
      if (!ok) return res.status(403).json({ message: 'Not allowed to pin this thread' });
      data.isPinned = Boolean(req.body.isPinned);
    }
    if (req.body.title !== undefined || req.body.body !== undefined) {
      if (!sameId(row.authorId, req.user._id)) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      const nextTitle = req.body.title !== undefined ? String(req.body.title).trim() : row.title;
      const nextBody = req.body.body !== undefined ? String(req.body.body).trim() : row.body;
      if (!nextTitle) {
        return res.status(400).json({ message: 'Title is required' });
      }
      data.title = nextTitle;
      data.body = nextBody;
    }
    if (Object.keys(data).length) {
      await prisma.thread.update({ where: { id: row.id }, data });
    }

    const updated = await threadService.getThreadById(row.id);
    res.json(updated);
  })
);

router.get(
  '/:id/replies',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const rows = await prisma.reply.findMany({
      where: { threadId: String(thread._id) },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });

    let formatted = rows.map((r) => formatReply(r));
    if (req.user?._id) {
      formatted = await attachMyVotes(formatted, 'reply', req.user._id);
    }

    res.json(formatted);
  })
);

router.post(
  '/:id/replies',
  requireAuth,
  replyCreateRateLimit,
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    if (thread.isLocked) {
      return res.status(403).json({ message: 'Thread is locked — new replies are disabled' });
    }

    const { body, parentReplyId } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ message: 'Reply body is required' });
    }

    if (parentReplyId) {
      const parent = await replyService.findReplyInThread({
        replyId: parentReplyId,
        threadId: thread._id,
      });
      if (!parent) {
        return res.status(400).json({ message: 'Parent reply not found' });
      }
      const parentDepth = await getReplyDepth(parent._id);
      if (parentDepth >= MAX_REPLY_DEPTH - 1) {
        return res.status(400).json({ message: 'Maximum reply nesting reached' });
      }
    }

    const reply = await replyService.createReply({
      threadId: thread._id,
      body: body.trim(),
      authorId: req.user._id,
      parentReplyId: parentReplyId || null,
    });

    await threadService.incrementThreadReplyCount(thread._id, 1);

    const authorId = thread.authorId || thread.author?._id;
    if (!sameId(authorId, req.user._id)) {
      await createNotification({
        userId: authorId,
        type: 'reply',
        title: 'New response to your question',
        body: thread.title,
        link: `/t/${thread._id}`,
        actorId: req.user._id,
      });
    }

    res.status(201).json(reply);
  })
);

router.patch(
  '/:id/replies/:replyId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const reply = await replyService.findReplyInThread({
      replyId: req.params.replyId,
      threadId: req.params.id,
    });
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    if (!sameId(reply.author?._id, req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const { body } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ message: 'Reply body is required' });
    }

    const updated = await replyService.updateReplyBody(reply._id, body.trim());
    res.json(updated);
  })
);

router.delete(
  '/:id/replies/:replyId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const reply = await replyService.findReplyInThread({
      replyId: req.params.replyId,
      threadId: thread._id,
    });
    if (!reply) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    if (!sameId(reply.author?._id, req.user._id) && !(await canModerateThread(req.user._id, thread))) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const subtreeIds = await replyService.collectReplySubtreeIds(reply._id);

    await prisma.vote.deleteMany({
      where: { targetType: 'reply', targetId: { in: subtreeIds } },
    });
    await replyService.deleteReplySubtree(subtreeIds);

    // Recompute from the actual row count rather than writing a snapshot-based
    // absolute value, so concurrent deletions on the same thread can't clobber
    // each other's decrement (lost update), and the count can't drift when a
    // multi-level subtree is removed in one go.
    const remaining = await prisma.reply.count({ where: { threadId: String(thread._id) } });
    await threadService.setThreadReplyCount(thread._id, remaining);

    res.json({ message: 'Deleted' });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    if (!sameId(thread.author?._id, req.user._id) && !(await canModerateThread(req.user._id, thread))) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const replyIds = (
      await prisma.reply.findMany({
        where: { threadId: String(thread._id) },
        select: { id: true },
      })
    ).map((r) => r.id);

    await prisma.vote.deleteMany({ where: { targetType: 'thread', targetId: String(thread._id) } });
    if (replyIds.length > 0) {
      await prisma.vote.deleteMany({
        where: { targetType: 'reply', targetId: { in: replyIds } },
      });
    }
    await replyService.deleteAllRepliesForThread(thread._id);
    await synthesisService.deleteSynthesisForThread(thread._id);
    await threadService.deleteThread(thread._id);

    res.json({ message: 'Deleted' });
  })
);

router.post(
  '/:id/crosspost',
  requireAuth,
  threadCreateRateLimit,
  asyncHandler(async (req, res) => {
    const { categorySlug, categoryId, title, body } = req.body;
    const { createCrosspost } = require('../utils/threadCrosspost');

    let category = null;
    if (categoryId) {
      category = await categoryService.findCategoryById(categoryId);
    } else if (categorySlug) {
      category = await categoryService.findCategoryBySlug(categorySlug);
    }
    if (!category) {
      return res.status(400).json({ message: 'Valid target field is required' });
    }

    try {
      const thread = await createCrosspost({
        sourceThreadId: req.params.id,
        authorId: req.user._id,
        categoryId: category._id,
        title,
        body,
      });
      enqueueAnalytics('post_crossposted', {
        sourceThreadId: req.params.id,
        threadId: thread._id,
        authorId: req.user._id,
        categoryId: category._id,
      });
      res.status(201).json(thread);
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ message: err.message || 'Crosspost failed' });
    }
  })
);

router.post(
  '/:id/poll/vote',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ message: 'optionId is required' });
    }
    const { voteOnThreadPoll } = require('../utils/threadPoll');
    try {
      const poll = await voteOnThreadPoll(req.params.id, {
        optionId,
        userId: req.user._id,
      });
      res.json({ poll });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ message: err.message || 'Vote failed' });
    }
  })
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const thread = await threadService.getThreadById(req.params.id, {
      includeMind: true,
      viewerUserId: req.user?._id,
    });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    if (req.user?._id) {
      const [withVote] = await attachMyVotes([thread], 'thread', req.user._id);
      return res.json(withVote);
    }
    res.json(thread);
  })
);

module.exports = router;
