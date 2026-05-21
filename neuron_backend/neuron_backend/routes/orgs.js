const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { slugify, formatProject } = require('../utils/projectSerialize');
const {
  formatOrganization,
  formatOrgMember,
  requireOrgRole,
  getOrganizationMembership,
} = require('../utils/orgAccess');
const { resolveOwnerNamespace, projectInclude } = require('../utils/projectLookup');

const router = express.Router();

const ORG_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { q, limit = '30' } = req.query;
    const take = Math.min(parseInt(limit, 10) || 30, 50);
    const where = {};
    if (q && String(q).trim().length >= 2) {
      const term = String(q).trim().toLowerCase();
      where.OR = [
        { slug: { contains: term } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { _count: { select: { members: true, projects: true } } },
    });
    res.json({
      organizations: rows.map((o) =>
        formatOrganization(o, {
          memberCount: o._count.members,
          projectCount: o._count.projects,
        })
      ),
    });
  })
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await prisma.organizationMember.findMany({
      where: { userId: req.user._id },
      include: {
        organization: {
          include: { _count: { select: { members: true, projects: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      organizations: rows.map((m) =>
        formatOrganization(m.organization, {
          memberCount: m.organization._count.members,
          projectCount: m.organization._count.projects,
          viewerRole: m.role,
        })
      ),
    });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const slugRaw = String(req.body?.slug || name || '').trim().toLowerCase();
    const slug = slugify(slugRaw) || slugRaw.replace(/[^a-z0-9_-]/g, '');
    if (!name) return res.status(400).json({ message: 'Organization name is required' });
    if (!ORG_SLUG_RE.test(slug)) {
      return res.status(400).json({ message: 'Invalid organization slug' });
    }

    const userTaken = await prisma.user.findUnique({ where: { username: slug } });
    if (userTaken) {
      return res.status(409).json({ message: 'Slug conflicts with an existing username' });
    }

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ message: 'Organization slug already taken' });

    const org = await prisma.organization.create({
      data: {
        name: name.slice(0, 120),
        slug,
        description: String(req.body?.description || '').trim().slice(0, 2000),
        members: {
          create: {
            userId: req.user._id,
            role: 'OWNER',
          },
        },
      },
    });

    res.status(201).json(
      formatOrganization(org, { memberCount: 1, projectCount: 0, viewerRole: 'OWNER' })
    );
  })
);

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const ns = await resolveOwnerNamespace(req.params.slug);
    if (!ns || ns.type !== 'organization') {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: ns.id },
      include: { _count: { select: { members: true, projects: true } } },
    });

    let viewerRole = null;
    if (req.user?._id) {
      const member = await getOrganizationMembership(org.id, req.user._id);
      viewerRole = member?.role || null;
    }

    res.json(
      formatOrganization(org, {
        memberCount: org._count.members,
        projectCount: org._count.projects,
        viewerRole,
      })
    );
  })
);

router.get(
  '/:slug/projects',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const ns = await resolveOwnerNamespace(req.params.slug);
    if (!ns || ns.type !== 'organization') {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const rows = await prisma.project.findMany({
      where: { organizationId: ns.id },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(parseInt(req.query.limit, 10) || 50, 50),
    });

    const projects = await Promise.all(
      rows.map(async (p) => {
        const openIssueCount = await prisma.issue.count({
          where: { projectId: p.id, status: 'open' },
        });
        const openPullCount = await prisma.pullRequest.count({
          where: { projectId: p.id, status: 'open' },
        });
        return formatProject({ ...p, openIssueCount, openPullCount }, ns.slug);
      })
    );

    res.json({ projects });
  })
);

router.get(
  '/:slug/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ns = await resolveOwnerNamespace(req.params.slug);
    if (!ns || ns.type !== 'organization') {
      return res.status(404).json({ message: 'Organization not found' });
    }
    await requireOrgRole(ns.id, req.user._id, 'MEMBER');

    const rows = await prisma.organizationMember.findMany({
      where: { organizationId: ns.id },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    res.json({ members: rows.map(formatOrgMember) });
  })
);

router.post(
  '/:slug/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ns = await resolveOwnerNamespace(req.params.slug);
    if (!ns || ns.type !== 'organization') {
      return res.status(404).json({ message: 'Organization not found' });
    }
    await requireOrgRole(ns.id, req.user._id, 'ADMIN');

    const username = String(req.body?.username || '').trim().toLowerCase();
    const role = String(req.body?.role || 'MEMBER').toUpperCase();
    if (!['MEMBER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'role must be MEMBER or ADMIN' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const row = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: ns.id, userId: user.id },
      },
      create: { organizationId: ns.id, userId: user.id, role },
      update: { role },
      include: { user: true },
    });

    res.status(201).json(formatOrgMember(row));
  })
);

router.delete(
  '/:slug/members/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ns = await resolveOwnerNamespace(req.params.slug);
    if (!ns || ns.type !== 'organization') {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const targetId = String(req.params.userId);
    const acting = await getOrganizationMembership(ns.id, req.user._id);
    if (!acting) return res.status(403).json({ message: 'Organization access required' });

    const target = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: ns.id, userId: targetId } },
    });
    if (!target) return res.status(404).json({ message: 'Member not found' });

    if (target.role === 'OWNER') {
      return res.status(400).json({ message: 'Cannot remove organization owner' });
    }
    if (acting.role !== 'OWNER' && acting.role !== 'ADMIN' && targetId !== req.user._id) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: ns.id, userId: targetId } },
    });
    res.json({ message: 'Member removed' });
  })
);

module.exports = router;
