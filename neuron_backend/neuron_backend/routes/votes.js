const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { castVote } = require('../utils/votes');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { targetType, targetId, value } = req.body;
    if (!targetType || !targetId) {
      return res.status(400).json({ message: 'targetType and targetId are required' });
    }
    const parsed = value === 0 || value === '0' ? 0 : parseInt(value, 10);
    if (![1, -1, 0].includes(parsed)) {
      return res.status(400).json({ message: 'value must be 1, -1, or 0' });
    }

    const result = await castVote(req.user._id, targetType, targetId, parsed);
    res.json(result);
  })
);

module.exports = router;
