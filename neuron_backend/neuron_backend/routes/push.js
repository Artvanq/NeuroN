const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { isWebPushConfigured, getVapidPublicKey } = require('../utils/webPush');

const router = express.Router();

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({
      enabled: isWebPushConfigured(),
      publicKey: getVapidPublicKey(),
    });
  })
);

router.use(requireAuth);

router.get(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const rows = await prisma.pushSubscription.findMany({
      where: { userId: req.user._id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
      },
    });
    res.json({
      subscriptions: rows.map((r) => ({
        _id: r.id,
        endpoint: r.endpoint,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
      })),
    });
  })
);

router.post(
  '/subscribe',
  asyncHandler(async (req, res) => {
    if (!isWebPushConfigured()) {
      return res.status(503).json({ message: 'Web push is not configured on this server' });
    }

    const endpoint = String(req.body?.endpoint || '').trim();
    const p256dh = String(req.body?.keys?.p256dh || req.body?.p256dh || '').trim();
    const auth = String(req.body?.keys?.auth || req.body?.auth || '').trim();

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ message: 'endpoint and keys (p256dh, auth) are required' });
    }

    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

    const row = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user._id,
        endpoint,
        p256dh,
        auth,
        userAgent,
      },
      update: {
        userId: req.user._id,
        p256dh,
        auth,
        userAgent,
      },
    });

    res.status(201).json({
      _id: row.id,
      endpoint: row.endpoint,
      createdAt: row.createdAt,
    });
  })
);

router.delete(
  '/subscribe',
  asyncHandler(async (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ message: 'endpoint is required' });

    await prisma.pushSubscription.deleteMany({
      where: { userId: req.user._id, endpoint },
    });
    res.json({ message: 'Unsubscribed' });
  })
);

module.exports = router;
