const express = require('express');
const reportService = require('../services/reports');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { createNotification } = require('../utils/notify');
const { verifyCaptchaToken } = require('../utils/captcha');
const { decayReportAbuseScore } = require('../utils/reportAbuse');
const { getModerationPolicy } = require('../utils/moderationPolicy');
const { moderationExportRateLimit } = require('../middleware/rateLimit');
const { canModerate } = require('../utils/rbac');

const {
  allowedTargets: ALLOWED_TARGETS,
  allowedStatuses: ALLOWED_STATUSES,
  allowedActions: ALLOWED_ACTIONS,
} = getModerationPolicy();

const router = express.Router();

async function resolveTargetUserId(targetType, targetId) {
  const type = String(targetType || '').toLowerCase();
  const id = String(targetId || '');
  if (!id) return null;
  if (type === 'user') return id;
  if (type === 'thread') {
    const row = await prisma.thread.findUnique({ where: { id }, select: { authorId: true } });
    return row?.authorId || null;
  }
  if (type === 'reply') {
    const row = await prisma.reply.findUnique({ where: { id }, select: { authorId: true } });
    return row?.authorId || null;
  }
  if (type === 'message') {
    const row = await prisma.message.findUnique({ where: { id }, select: { senderId: true } });
    return row?.senderId || null;
  }
  if (type === 'project') {
    const pathParts = id.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const owner = await prisma.user.findUnique({
        where: { username: pathParts[0].toLowerCase() },
        select: { id: true },
      });
      return owner?.id || null;
    }
    const row = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    return row?.ownerId || null;
  }
  if (type === 'file') {
    const m = id.match(/^([^/]+)\/([^:]+):(.+)$/);
    if (!m) return null;
    const owner = await prisma.user.findUnique({
      where: { username: m[1].toLowerCase() },
      select: { id: true },
    });
    return owner?.id || null;
  }
  return null;
}

const { findProjectByPath: lookupProjectByPath } = require('../utils/projectLookup');

async function resolveProjectByPath(ownerSlug) {
  const [ownerRaw, slugRaw] = String(ownerSlug || '').split('/').filter(Boolean);
  if (!ownerRaw || !slugRaw) return null;
  const found = await lookupProjectByPath(ownerRaw, slugRaw);
  if (!found) return null;
  return found.project;
}

async function targetExists(targetType, targetId) {
  const type = String(targetType || '').toLowerCase();
  const id = String(targetId || '').trim();
  if (!id) return false;

  if (type === 'user') {
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    return Boolean(u?.id);
  }
  if (type === 'thread') {
    const t = await prisma.thread.findUnique({ where: { id }, select: { id: true } });
    return Boolean(t?.id);
  }
  if (type === 'reply') {
    const r = await prisma.reply.findUnique({ where: { id }, select: { id: true } });
    return Boolean(r?.id);
  }
  if (type === 'message') {
    const m = await prisma.message.findUnique({ where: { id }, select: { id: true } });
    return Boolean(m?.id);
  }
  if (type === 'project') {
    const pathParts = id.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return Boolean(await resolveProjectByPath(`${pathParts[0]}/${pathParts[1]}`));
    }
    const p = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    return Boolean(p?.id);
  }
  if (type === 'file') {
    const m = id.match(/^([^/]+)\/([^:]+):(.+)$/);
    if (!m) return false;
    const [, owner, slug] = m;
    return Boolean(await resolveProjectByPath(`${owner}/${slug}`));
  }
  return false;
}

async function resolveTargetLink(targetType, targetId) {
  const type = String(targetType || '').toLowerCase();
  const id = String(targetId || '').trim();
  if (!id) return { href: null, label: null };

  if (type === 'thread') {
    return { href: `/t/${encodeURIComponent(id)}`, label: 'Open thread' };
  }

  if (type === 'reply') {
    const reply = await prisma.reply.findUnique({
      where: { id },
      select: { threadId: true },
    });
    if (!reply?.threadId) return { href: null, label: null };
    return {
      href: `/t/${encodeURIComponent(reply.threadId)}#reply-${encodeURIComponent(id)}`,
      label: 'Open reply in thread',
    };
  }

  if (type === 'user') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { username: true },
    });
    if (!user?.username) return { href: null, label: null };
    return {
      href: `/u/${encodeURIComponent(user.username)}`,
      label: `Open @${user.username}`,
    };
  }

  if (type === 'project') {
    const pathParts = id.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return {
        href: `/p/${encodeURIComponent(pathParts[0])}/${encodeURIComponent(pathParts[1])}`,
        label: 'Open project',
      };
    }
    const project = await prisma.project.findUnique({
      where: { id },
      include: { owner: { select: { username: true } } },
    });
    if (!project?.owner?.username) return { href: null, label: null };
    return {
      href: `/p/${encodeURIComponent(project.owner.username)}/${encodeURIComponent(project.slug)}`,
      label: 'Open project',
    };
  }

  if (type === 'file') {
    const m = id.match(/^([^/]+)\/([^:]+):(.+)$/);
    if (!m) return { href: null, label: null };
    const [, owner, slug, path] = m;
    return {
      href: `/p/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/code?path=${encodeURIComponent(path)}`,
      label: 'Open file',
    };
  }

  return { href: null, label: null };
}

async function resolveTargetPreview(targetType, targetId) {
  const type = String(targetType || '').toLowerCase();
  const id = String(targetId || '').trim();
  if (!id) return null;

  if (type === 'thread') {
    const row = await prisma.thread.findUnique({
      where: { id },
      select: { title: true },
    });
    return row?.title ? `Thread: ${row.title}` : null;
  }

  if (type === 'reply') {
    const row = await prisma.reply.findUnique({
      where: { id },
      include: { author: { select: { username: true } } },
    });
    if (!row) return null;
    return `Reply by @${row.author?.username || 'unknown'}: ${String(row.body || '').slice(0, 80)}`;
  }

  if (type === 'user') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { username: true, displayName: true },
    });
    if (!user) return null;
    return user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`;
  }

  if (type === 'message') {
    const row = await prisma.message.findUnique({
      where: { id },
      include: { sender: { select: { username: true } } },
    });
    if (!row) return null;
    return `Message by @${row.sender?.username || 'unknown'}: ${String(row.body || '').slice(0, 80)}`;
  }

  if (type === 'project') {
    const pathParts = id.split('/').filter(Boolean);
    if (pathParts.length >= 2) return `${pathParts[0]}/${pathParts[1]}`;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { owner: { select: { username: true } } },
    });
    if (!project?.owner?.username) return null;
    return `${project.owner.username}/${project.slug}`;
  }

  if (type === 'file') {
    const m = id.match(/^([^/]+)\/([^:]+):(.+)$/);
    if (!m) return id;
    const [, owner, slug, path] = m;
    return `${owner}/${slug}:${path}`;
  }

  return id;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(',');
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { targetType, targetId, reason, captchaToken } = req.body;
    if (!targetType || !targetId || !reason?.trim()) {
      return res.status(400).json({ message: 'targetType, targetId, and reason are required' });
    }
    if (!ALLOWED_TARGETS.includes(String(targetType).toLowerCase())) {
      return res.status(400).json({ message: 'Invalid targetType' });
    }
    if (String(reason || '').trim().length < 6) {
      return res.status(400).json({ message: 'Reason is too short' });
    }

    const type = String(targetType).toLowerCase();
    if (!(await targetExists(type, targetId))) {
      return res.status(404).json({ message: 'Target not found' });
    }

    const reportCaptchaSecret = process.env.REPORT_CAPTCHA_SECRET || process.env.CAPTCHA_SECRET;
    if (reportCaptchaSecret) {
      const captcha = await verifyCaptchaToken({
        token: captchaToken,
        remoteIp: req.ip || req.headers['x-forwarded-for'],
        secret: reportCaptchaSecret,
      });
      if (!captcha.ok) {
        return res.status(400).json({ message: captcha.message });
      }
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await prisma.report.count({
      where: { reporterId: req.user._id, createdAt: { gte: oneHourAgo } },
    });
    if (recentReports >= 20) {
      return res.status(429).json({ message: 'Too many reports sent. Please try later.' });
    }
    const userState = await prisma.user.findUnique({
      where: { id: req.user._id },
      select: { reportAbuseScore: true, reportAbuseUpdatedAt: true },
    });
    const decayed = decayReportAbuseScore({
      score: userState?.reportAbuseScore || 0,
      updatedAt: userState?.reportAbuseUpdatedAt || null,
    });
    if (decayed.changed) {
      await prisma.user.update({
        where: { id: req.user._id },
        data: {
          reportAbuseScore: decayed.score,
          reportAbuseUpdatedAt: decayed.updatedAt,
        },
      });
    }
    const abuseScore = decayed.score;
    const abuseBlockThreshold = Number(process.env.REPORT_ABUSE_BLOCK_THRESHOLD || 12);
    if (abuseScore >= abuseBlockThreshold) {
      return res.status(429).json({ message: 'Report access is temporarily limited due to abuse' });
    }

    const duplicateOpen = await prisma.report.findFirst({
      where: {
        reporterId: req.user._id,
        targetType: type,
        targetId: String(targetId),
        status: 'open',
      },
      select: { id: true },
    });
    if (duplicateOpen) {
      return res.status(409).json({ message: 'You already have an open report for this target' });
    }

    const report = await reportService.createReport({
      reporterId: req.user._id,
      targetType: type,
      targetId,
      reason: reason.trim().slice(0, 500),
    });

    res.status(201).json(report);
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const {
      status = 'open',
      targetType,
      reporterUsername,
      q,
      limit = '50',
      cursor,
    } = req.query;

    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const where = {};
    if (status !== 'all') where.status = String(status).toLowerCase();
    if (targetType) where.targetType = String(targetType).toLowerCase();
    if (reporterUsername) {
      where.reporter = {
        username: { contains: String(reporterUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }
    if (q && String(q).trim().length >= 2) {
      where.OR = [
        { reason: { contains: String(q).trim(), mode: 'insensitive' } },
        { targetId: { contains: String(q).trim(), mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.report.findMany({
      where,
      include: { reporter: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      take,
    });
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const link = await resolveTargetLink(r.targetType, r.targetId);
        const preview = await resolveTargetPreview(r.targetType, r.targetId);
        return {
          _id: r.id,
          reporter: r.reporter
            ? {
                _id: r.reporter.id,
                username: r.reporter.username,
                displayName: r.reporter.displayName,
                avatarUrl: r.reporter.avatarUrl || null,
              }
            : null,
          targetType: r.targetType,
          targetId: r.targetId,
          targetHref: link.href,
          targetLabel: link.label,
          targetPreview: preview,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        };
      })
    );
    const nextCursor = rows.length === take ? rows[rows.length - 1].id : null;
    res.json({ items: enriched, nextCursor });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const { status, action = 'none', note } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const existing = await prisma.report.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (action === 'content_removed') {
      if (existing.targetType === 'thread') {
        const t = await prisma.thread.findUnique({ where: { id: existing.targetId } });
        if (!t) return res.status(404).json({ message: 'Target thread not found' });
        await prisma.thread.update({
          where: { id: existing.targetId },
          data: {
            title: '[Removed by moderation]',
            body: '[Content removed by moderation]',
          },
        });
      } else if (existing.targetType === 'reply') {
        const r = await prisma.reply.findUnique({ where: { id: existing.targetId } });
        if (!r) return res.status(404).json({ message: 'Target reply not found' });
        await prisma.reply.update({
          where: { id: existing.targetId },
          data: { body: '[Content removed by moderation]' },
        });
      }
    }
    if (action === 'user_banned') {
      const targetUserId = await resolveTargetUserId(existing.targetType, existing.targetId);
      if (!targetUserId) {
        return res.status(400).json({ message: 'Cannot resolve target user for ban action' });
      }
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          isBanned: true,
          bannedReason: String(note || 'Banned by moderation').slice(0, 300),
          bannedAt: new Date(),
        },
      });
    }
    if (action === 'user_unbanned') {
      const targetUserId = await resolveTargetUserId(existing.targetType, existing.targetId);
      if (!targetUserId) {
        return res.status(400).json({ message: 'Cannot resolve target user for unban action' });
      }
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          isBanned: false,
          bannedReason: '',
          bannedAt: null,
        },
      });
    }
    if (action === 'warning_sent') {
      const targetUserId = await resolveTargetUserId(existing.targetType, existing.targetId);
      if (!targetUserId) {
        return res.status(400).json({ message: 'Cannot resolve target user for warning action' });
      }
      await createNotification({
        userId: targetUserId,
        type: 'moderation_warning',
        title: 'Moderation warning',
        body: String(note || 'Your recent activity was reviewed by moderators').slice(0, 300),
        link: '/settings',
        actorId: req.user._id,
      });
    }

    const report = await reportService.updateReportStatus(req.params.id, status);

    if (status === 'dismissed') {
      await prisma.user.update({
        where: { id: existing.reporterId },
        data: {
          reportAbuseScore: { increment: 2 },
          reportAbuseUpdatedAt: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.reporterId },
        data: {
          reportAbuseScore: { decrement: 1 },
          reportAbuseUpdatedAt: new Date(),
        },
      }).catch(() => {});
      await prisma.user.updateMany({
        where: { id: existing.reporterId, reportAbuseScore: { lt: 0 } },
        data: { reportAbuseScore: 0 },
      });
    }

    await prisma.moderationAction.create({
      data: {
        moderatorId: req.user._id,
        reportId: existing.id,
        targetType: existing.targetType,
        targetId: existing.targetId,
        action,
        note: String(note || '').slice(0, 500),
        meta: { status },
      },
    });
    res.json(report);
  })
);

router.get(
  '/log',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const { action, targetType, moderatorUsername, limit = '200', cursor } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const where = {};
    if (action) where.action = String(action).toLowerCase();
    if (targetType) where.targetType = String(targetType).toLowerCase();
    if (moderatorUsername) {
      where.moderator = {
        username: { contains: String(moderatorUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }

    const rows = await prisma.moderationAction.findMany({
      where,
      include: {
        moderator: { select: { id: true, username: true, displayName: true } },
        report: { select: { id: true, status: true, targetType: true, targetId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
      take,
    });

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const link = await resolveTargetLink(r.targetType, r.targetId);
        const preview = await resolveTargetPreview(r.targetType, r.targetId);
        return {
          _id: r.id,
          moderator: r.moderator,
          report: r.report
            ? {
                _id: r.report.id,
                status: r.report.status,
                targetType: r.report.targetType,
                targetId: r.report.targetId,
              }
            : null,
          targetType: r.targetType,
          targetId: r.targetId,
          targetHref: link.href,
          targetLabel: link.label,
          targetPreview: preview,
          action: r.action,
          note: r.note,
          meta: r.meta,
          createdAt: r.createdAt,
        };
      })
    );
    const nextCursor = rows.length === take ? rows[rows.length - 1].id : null;
    res.json({ items: enriched, nextCursor });
  })
);

router.get(
  '/export',
  requireAuth,
  moderationExportRateLimit,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const {
      reportStatus = 'all',
      reportTargetType,
      reportReporterUsername,
      reportQ,
      auditAction = 'all',
      auditTargetType,
      auditModeratorUsername,
      reportLimit = '1000',
      auditLimit = '2000',
    } = req.query;

    const reportTake = Math.min(Math.max(parseInt(reportLimit, 10) || 1000, 1), 5000);
    const auditTake = Math.min(Math.max(parseInt(auditLimit, 10) || 2000, 1), 10000);

    const reportWhere = {};
    if (reportStatus !== 'all') reportWhere.status = String(reportStatus).toLowerCase();
    if (reportTargetType) reportWhere.targetType = String(reportTargetType).toLowerCase();
    if (reportReporterUsername) {
      reportWhere.reporter = {
        username: { contains: String(reportReporterUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }
    if (reportQ && String(reportQ).trim().length >= 2) {
      reportWhere.OR = [
        { reason: { contains: String(reportQ).trim(), mode: 'insensitive' } },
        { targetId: { contains: String(reportQ).trim(), mode: 'insensitive' } },
      ];
    }

    const auditWhere = {};
    if (auditAction !== 'all') auditWhere.action = String(auditAction).toLowerCase();
    if (auditTargetType) auditWhere.targetType = String(auditTargetType).toLowerCase();
    if (auditModeratorUsername) {
      auditWhere.moderator = {
        username: { contains: String(auditModeratorUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }

    const [totalReports, totalAudit, reportRows, auditRows] = await Promise.all([
      prisma.report.count({ where: reportWhere }),
      prisma.moderationAction.count({ where: auditWhere }),
      prisma.report.findMany({
        where: reportWhere,
        include: { reporter: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: reportTake,
      }),
      prisma.moderationAction.findMany({
        where: auditWhere,
        include: {
          moderator: { select: { id: true, username: true, displayName: true } },
          report: { select: { id: true, status: true, targetType: true, targetId: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: auditTake,
      }),
    ]);

    const reports = await Promise.all(
      reportRows.map(async (r) => {
        const link = await resolveTargetLink(r.targetType, r.targetId);
        const preview = await resolveTargetPreview(r.targetType, r.targetId);
        return {
          _id: r.id,
          reporter: r.reporter
            ? {
                _id: r.reporter.id,
                username: r.reporter.username,
                displayName: r.reporter.displayName,
                avatarUrl: r.reporter.avatarUrl || null,
              }
            : null,
          targetType: r.targetType,
          targetId: r.targetId,
          targetHref: link.href,
          targetLabel: link.label,
          targetPreview: preview,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        };
      })
    );

    const audit = await Promise.all(
      auditRows.map(async (r) => {
        const link = await resolveTargetLink(r.targetType, r.targetId);
        const preview = await resolveTargetPreview(r.targetType, r.targetId);
        return {
          _id: r.id,
          moderator: r.moderator,
          report: r.report
            ? {
                _id: r.report.id,
                status: r.report.status,
                targetType: r.report.targetType,
                targetId: r.report.targetId,
              }
            : null,
          targetType: r.targetType,
          targetId: r.targetId,
          targetHref: link.href,
          targetLabel: link.label,
          targetPreview: preview,
          action: r.action,
          note: r.note,
          meta: r.meta,
          createdAt: r.createdAt,
        };
      })
    );

    res.json({
      exportedAt: new Date().toISOString(),
      filters: {
        reportStatus,
        reportTargetType: reportTargetType || null,
        reportReporterUsername: reportReporterUsername || null,
        reportQ: reportQ || null,
        auditAction,
        auditTargetType: auditTargetType || null,
        auditModeratorUsername: auditModeratorUsername || null,
      },
      limits: { reports: reportTake, audit: auditTake },
      counts: { reports: reports.length, audit: audit.length },
      totals: { reports: totalReports, audit: totalAudit },
      truncated: {
        reports: totalReports > reports.length,
        audit: totalAudit > audit.length,
      },
      reports,
      audit,
    });
  })
);

router.get(
  '/export.csv',
  requireAuth,
  moderationExportRateLimit,
  asyncHandler(async (req, res) => {
    if (!canModerate(req.user)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }

    const {
      reportStatus = 'all',
      reportTargetType,
      reportReporterUsername,
      reportQ,
      auditAction = 'all',
      auditTargetType,
      auditModeratorUsername,
      reportLimit = '1000',
      auditLimit = '2000',
    } = req.query;

    const reportTake = Math.min(Math.max(parseInt(reportLimit, 10) || 1000, 1), 5000);
    const auditTake = Math.min(Math.max(parseInt(auditLimit, 10) || 2000, 1), 10000);

    const reportWhere = {};
    if (reportStatus !== 'all') reportWhere.status = String(reportStatus).toLowerCase();
    if (reportTargetType) reportWhere.targetType = String(reportTargetType).toLowerCase();
    if (reportReporterUsername) {
      reportWhere.reporter = {
        username: { contains: String(reportReporterUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }
    if (reportQ && String(reportQ).trim().length >= 2) {
      reportWhere.OR = [
        { reason: { contains: String(reportQ).trim(), mode: 'insensitive' } },
        { targetId: { contains: String(reportQ).trim(), mode: 'insensitive' } },
      ];
    }

    const auditWhere = {};
    if (auditAction !== 'all') auditWhere.action = String(auditAction).toLowerCase();
    if (auditTargetType) auditWhere.targetType = String(auditTargetType).toLowerCase();
    if (auditModeratorUsername) {
      auditWhere.moderator = {
        username: { contains: String(auditModeratorUsername).trim().toLowerCase(), mode: 'insensitive' },
      };
    }

    const [totalReports, totalAudit, reportRows, auditRows] = await Promise.all([
      prisma.report.count({ where: reportWhere }),
      prisma.moderationAction.count({ where: auditWhere }),
      prisma.report.findMany({
        where: reportWhere,
        include: { reporter: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: reportTake,
      }),
      prisma.moderationAction.findMany({
        where: auditWhere,
        include: {
          moderator: { select: { id: true, username: true, displayName: true } },
          report: { select: { id: true, status: true, targetType: true, targetId: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: auditTake,
      }),
    ]);

    const reportItems = await Promise.all(
      reportRows.map(async (r) => ({
        kind: 'report',
        createdAt: r.createdAt?.toISOString?.() || r.createdAt,
        actorUsername: r.reporter?.username || '',
        statusOrAction: r.status,
        targetType: r.targetType,
        targetId: r.targetId,
        targetPreview: await resolveTargetPreview(r.targetType, r.targetId),
        reason: r.reason,
        note: '',
        relatedReportId: r.id,
      }))
    );

    const auditItems = await Promise.all(
      auditRows.map(async (r) => ({
        kind: 'audit',
        createdAt: r.createdAt?.toISOString?.() || r.createdAt,
        actorUsername: r.moderator?.username || '',
        statusOrAction: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        targetPreview: await resolveTargetPreview(r.targetType, r.targetId),
        reason: '',
        note: r.note || '',
        relatedReportId: r.report?.id || '',
      }))
    );

    const rows = [
      toCsvRow([
        'kind',
        'createdAt',
        'actorUsername',
        'statusOrAction',
        'targetType',
        'targetId',
        'targetPreview',
        'reason',
        'note',
        'relatedReportId',
      ]),
      ...reportItems.map((r) =>
        toCsvRow([
          r.kind,
          r.createdAt,
          r.actorUsername,
          r.statusOrAction,
          r.targetType,
          r.targetId,
          r.targetPreview,
          r.reason,
          r.note,
          r.relatedReportId,
        ])
      ),
      ...auditItems.map((r) =>
        toCsvRow([
          r.kind,
          r.createdAt,
          r.actorUsername,
          r.statusOrAction,
          r.targetType,
          r.targetId,
          r.targetPreview,
          r.reason,
          r.note,
          r.relatedReportId,
        ])
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="moderation-export-${Date.now()}.csv"`
    );
    res.setHeader('X-Neuron-Reports-Total', String(totalReports));
    res.setHeader('X-Neuron-Audit-Total', String(totalAudit));
    res.setHeader('X-Neuron-Reports-Returned', String(reportItems.length));
    res.setHeader('X-Neuron-Audit-Returned', String(auditItems.length));
    res.setHeader('X-Neuron-Reports-Truncated', String(totalReports > reportItems.length));
    res.setHeader('X-Neuron-Audit-Truncated', String(totalAudit > auditItems.length));
    res.send(rows.join('\n'));
  })
);

module.exports = router;
