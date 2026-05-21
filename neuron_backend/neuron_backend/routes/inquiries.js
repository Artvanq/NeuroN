const express = require('express');
const inquiryService = require('../services/inquiries');
const { optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { findThreadsPaginated } = require('../utils/threadPaginate');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const inquiries = await inquiryService.listInquiries({
      q: req.query.q,
      limit: req.query.limit,
    });
    res.json(inquiries);
  })
);

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const inquiry = await inquiryService.findBySlug(req.params.slug);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    res.json(inquiry);
  })
);

router.get(
  '/:slug/threads',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const inquiry = await inquiryService.findBySlug(req.params.slug);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });

    const { limit = '20', cursor, q, sort = 'hot' } = req.query;
    const filter = { inquiry: inquiry._id };
    const text = String(q || '').trim();
    if (text.length >= 2) filter.q = text;

    const { threads, nextCursor } = await findThreadsPaginated(filter, {
      sort,
      limit,
      cursor,
      viewerUserId: req.user?._id,
    });

    res.json({ inquiry, threads, nextCursor });
  })
);

module.exports = router;
