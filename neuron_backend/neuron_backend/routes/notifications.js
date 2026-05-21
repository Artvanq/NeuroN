const express = require('express');
const notificationService = require('../services/notifications');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit = '30', unreadOnly } = req.query;

    const notifications = await notificationService.listNotifications({
      userId: req.user._id,
      unreadOnly: unreadOnly === 'true',
      limit: Math.min(parseInt(limit, 10) || 30, 100),
    });

    const unreadCount = await notificationService.countUnreadNotifications(req.user._id);

    res.json({ notifications, unreadCount });
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationService.markAllNotificationsRead(req.user._id);
    res.json({ message: 'ok' });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markNotificationRead({
      notificationId: req.params.id,
      userId: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json(notification);
  })
);

module.exports = router;
