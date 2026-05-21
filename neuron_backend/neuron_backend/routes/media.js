const express = require('express');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { verifyUploadedMedia } = require('../utils/mediaScan');
const mediaStorage = require('../utils/mediaStorage');
const {
  isMediaUploadEnabled,
  prepareUpload,
  storeLocalUpload,
  verifyStoredObject,
  resolvePublicUrl,
  readLocalFile,
  mediaStorageMode,
} = mediaStorage;

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    enabled: isMediaUploadEnabled(),
    mode: mediaStorageMode(),
  });
});

const ALLOWED_KINDS = ['AVATAR', 'POST', 'CHAT', 'SUPPORT'];
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
];

const MAX_UPLOAD_BYTES = Number(process.env.R2_MAX_UPLOAD_BYTES || 25 * 1024 * 1024);

router.get(
  /^\/files\/(.+)$/,
  asyncHandler(async (req, res) => {
    const objectKey = decodeURIComponent(req.params[0]);
    if (!objectKey) return res.status(404).end();

    const media = await prisma.mediaFile.findFirst({
      where: { objectKey, status: 'READY' },
    });
    if (!media) return res.status(404).end();

    try {
      const data = await readLocalFile(objectKey);
      if (media.mimeType) res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(data);
    } catch {
      return res.status(404).end();
    }
  })
);

router.use(requireAuth);

router.post(
  '/presign',
  asyncHandler(async (req, res) => {
    if (!isMediaUploadEnabled()) {
      return res.status(503).json({
        message: 'Media storage is not configured (set R2_* or MEDIA_LOCAL_DIR on the server)',
      });
    }

    const { kind, mimeType, filename, sizeBytes } = req.body;
    const kindUpper = String(kind || 'POST').toUpperCase();

    if (!ALLOWED_KINDS.includes(kindUpper)) {
      return res.status(400).json({ message: 'Invalid media kind' });
    }
    if (!mimeType || !ALLOWED_MIME.includes(mimeType)) {
      return res.status(400).json({ message: 'Unsupported file type' });
    }
    if (sizeBytes && Number(sizeBytes) > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ message: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` });
    }

    const media = await prisma.mediaFile.create({
      data: {
        userId: req.user._id,
        kind: kindUpper,
        status: 'PENDING',
        bucket: 'pending',
        objectKey: 'pending',
        mimeType,
        sizeBytes: sizeBytes ? Number(sizeBytes) : null,
      },
    });

    const signed = await prepareUpload({
      userId: req.user._id,
      kind: kindUpper,
      filename,
      mimeType,
      sizeBytes,
      mediaId: media.id,
    });

    await prisma.mediaFile.update({
      where: { id: media.id },
      data: {
        bucket: signed.bucket,
        objectKey: signed.objectKey,
        publicUrl: signed.publicUrl,
      },
    });

    res.status(201).json({
      mediaId: media.id,
      uploadUrl: signed.uploadUrl,
      objectKey: signed.objectKey,
      publicUrl: signed.publicUrl,
      storage: signed.storage,
    });
  })
);

router.put(
  '/:id/upload',
  express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaFile.findUnique({ where: { id: req.params.id } });
    if (!media || media.userId !== req.user._id) {
      return res.status(404).json({ message: 'Media not found' });
    }
    if (!req.body?.length) {
      return res.status(400).json({ message: 'Empty upload body' });
    }

    await storeLocalUpload(media.objectKey, req.body);
    res.json({ message: 'Uploaded' });
  })
);

router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const media = await prisma.mediaFile.findUnique({ where: { id: req.params.id } });
    if (!media || media.userId !== req.user._id) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const exists = await verifyStoredObject(media.objectKey);
    if (!exists) {
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: { status: 'FAILED' },
      });
      return res.status(400).json({ message: 'Upload not found in storage — try again' });
    }

    const scanResult = await verifyUploadedMedia(media);
    if (!scanResult.ok) {
      await prisma.mediaFile.update({
        where: { id: media.id },
        data: { status: 'FAILED' },
      });
      return res.status(400).json({ message: scanResult.reason || 'Uploaded file failed security checks' });
    }

    const publicUrl = resolvePublicUrl(media);
    const updated = await prisma.mediaFile.update({
      where: { id: media.id },
      data: { status: 'READY', publicUrl },
    });

    if (media.kind === 'AVATAR' && publicUrl) {
      await prisma.user.update({
        where: { id: req.user._id },
        data: { avatarUrl: publicUrl },
      });
    }

    res.json({
      _id: updated.id,
      status: updated.status,
      publicUrl: updated.publicUrl,
      kind: updated.kind,
    });
  })
);

module.exports = router;
