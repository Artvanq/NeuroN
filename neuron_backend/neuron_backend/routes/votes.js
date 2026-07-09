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

    try {
      const result = await castVote(req.user._id, targetType, targetId, parsed);
      res.json(result);
    } catch (err) {
      // Two near-simultaneous votes from the same user can both pass the
      // "no existing vote" check before either commits; the unique
      // constraint on (userId, targetType, targetId) then rejects the
      // second create. Retry once instead of surfacing a 500.
      if (err?.code === 'P2002') {
        const result = await castVote(req.user._id, targetType, targetId, parsed);
        return res.json(result);
      }
      throw err;
    }
  })
);

module.exports = router;
