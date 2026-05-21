const express = require('express');
const prisma = require('../utils/prisma');
const categoryService = require('../services/categories');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { findThreadsPaginated } = require('../utils/threadPaginate');
const { canEditCategoryRules, canManageCategory } = require('../utils/categoryAccess');
const {
  listCategoryModerators,
  addCategoryModerator,
  removeCategoryModerator,
} = require('../utils/categoryModerators');
const { MAX_COMMUNITIES_PER_USER } = require('../utils/categoryCreate');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await categoryService.listCategories();
    res.json(categories);
  })
);

router.get(
  '/mine/list',
  requireAuth,
  asyncHandler(async (req, res) => {
    const categories = await categoryService.listUserCreatedCategories(req.user._id);
    res.json({ categories, limit: MAX_COMMUNITIES_PER_USER });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const row = await categoryService.createUserCategory({
        userId: req.user._id,
        name: req.body?.name,
        slug: req.body?.slug,
        description: req.body?.description,
        icon: req.body?.icon,
        color: req.body?.color,
        rules: req.body?.rules,
      });
      const category = await categoryService.findCategoryBySlug(row.slug, req.user);
      res.status(201).json(category);
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message });
    }
  })
);

router.patch(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.category.findUnique({
      where: { slug: String(req.params.slug).trim().toLowerCase() },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });
    if (!(await canEditCategoryRules(req.user, row.id))) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 80);
      if (!name) return res.status(400).json({ message: 'Name cannot be empty' });
      data.name = name;
    }
    if (req.body.description !== undefined) {
      data.description = String(req.body.description).trim().slice(0, 500);
    }
    if (req.body.icon !== undefined) {
      data.icon = String(req.body.icon).trim().slice(0, 8) || '📚';
    }
    if (req.body.color !== undefined) {
      const color = String(req.body.color).trim();
      if (/^#[0-9a-fA-F]{6}$/.test(color)) data.color = color.toLowerCase();
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updated = await prisma.category.update({ where: { id: row.id }, data });
    const category = await categoryService.findCategoryBySlug(updated.slug, req.user);
    res.json(category);
  })
);

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const category = await categoryService.findCategoryBySlug(req.params.slug, req.user);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  })
);

router.get(
  '/:slug/moderators',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.category.findUnique({
      where: { slug: String(req.params.slug).trim().toLowerCase() },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });
    const moderators = await listCategoryModerators(row.id);
    res.json({ moderators });
  })
);

router.post(
  '/:slug/moderators',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.category.findUnique({
      where: { slug: String(req.params.slug).trim().toLowerCase() },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });
    if (!(await canManageCategory(req.user, row.id))) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    const { username } = req.body;
    if (!username?.trim()) return res.status(400).json({ message: 'username is required' });
    try {
      const mod = await addCategoryModerator(row.id, username);
      res.status(201).json(mod);
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message });
    }
  })
);

router.delete(
  '/:slug/moderators/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.category.findUnique({
      where: { slug: String(req.params.slug).trim().toLowerCase() },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });
    if (!(await canManageCategory(req.user, row.id))) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    await removeCategoryModerator(row.id, req.params.userId);
    res.json({ message: 'Removed' });
  })
);

router.patch(
  '/:slug/rules',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.category.findUnique({
      where: { slug: String(req.params.slug).trim().toLowerCase() },
    });
    if (!row) return res.status(404).json({ message: 'Category not found' });
    if (!(await canEditCategoryRules(req.user, row.id))) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    const rules = String(req.body.rules ?? '').trim().slice(0, 16000);
    const updated = await prisma.category.update({
      where: { id: row.id },
      data: { rules },
    });
    const category = await categoryService.findCategoryBySlug(updated.slug, req.user);
    res.json(category);
  })
);

router.get(
  '/:slug/threads',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const category = await categoryService.findCategoryBySlug(req.params.slug, req.user);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const { limit = '20', cursor, q, sort = 'hot' } = req.query;
    const filter = { category: category._id };
    const query = String(q || '').trim();
    if (query.length >= 2) filter.q = query;

    const { threads, nextCursor } = await findThreadsPaginated(filter, {
      sort,
      limit,
      cursor,
      viewerUserId: req.user?._id,
    });

    res.json({ category, threads, nextCursor });
  })
);

module.exports = router;
