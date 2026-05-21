const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { translateText, translateBatch, normalizeLang } = require('../utils/translate');
const { contentLocales } = require('../utils/contentLocales');

const router = express.Router();

const allowedTargets = new Set(contentLocales.map((l) => l.code));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { text, targetLang, sourceLang } = req.body;
    const target = normalizeLang(targetLang);
    if (!target || !allowedTargets.has(target)) {
      return res.status(400).json({ message: 'Invalid target language' });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text is required' });
    }
    const result = await translateText(text, target, sourceLang || 'auto');
    res.json(result);
  })
);

router.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const { items, targetLang } = req.body;
    const target = normalizeLang(targetLang);
    if (!target || !allowedTargets.has(target)) {
      return res.status(400).json({ message: 'Invalid target language' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }
    if (items.length > 40) {
      return res.status(400).json({ message: 'Too many items (max 40)' });
    }
    const normalized = items.map((item, i) => ({
      id: String(item.id ?? i),
      text: String(item.text ?? ''),
    }));
    const results = await translateBatch(normalized, target);
    res.json({ results });
  })
);

module.exports = router;
