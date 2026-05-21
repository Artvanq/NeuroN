const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSlug,
  pickInquiry,
  MAX_INQUIRIES_PER_THREAD,
  SLUG_RE,
} = require('../services/inquiries');

test('normalizeSlug slugifies human text', () => {
  assert.equal(normalizeSlug('Nature of Time?'), 'nature-of-time');
  assert.equal(normalizeSlug('  Free   Will  '), 'free-will');
});

test('SLUG_RE accepts valid inquiry slugs', () => {
  assert.equal(SLUG_RE.test('nature-of-time'), true);
  assert.equal(SLUG_RE.test('free-will'), true);
  assert.equal(SLUG_RE.test('bad_slug'), false);
});

test('pickInquiry maps prisma row to API shape', () => {
  const row = {
    id: 'inq1',
    slug: 'consciousness',
    name: 'Consciousness',
    description: 'What it is like',
    isSeed: true,
    createdAt: new Date('2026-01-01'),
    _count: { threads: 3 },
  };
  const out = pickInquiry(row);
  assert.equal(out._id, 'inq1');
  assert.equal(out.slug, 'consciousness');
  assert.equal(out.threadCount, 3);
  assert.equal(out.isSeed, true);
});

test('MAX_INQUIRIES_PER_THREAD caps tags per post', () => {
  assert.equal(MAX_INQUIRIES_PER_THREAD, 5);
});

test('DEFAULT_CATEGORIES has 10 broad fields', () => {
  const { DEFAULT_CATEGORIES } = require('../utils/seedCategories');
  assert.equal(DEFAULT_CATEGORIES.length, 10);
  const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
  assert.ok(slugs.includes('mind'));
  assert.ok(slugs.includes('language'));
  assert.ok(slugs.includes('systems'));
  assert.ok(!slugs.includes('physics'));
});

test('DEFAULT_INQUIRIES has starter cross-field questions', () => {
  const { DEFAULT_INQUIRIES } = require('../utils/seedInquiries');
  assert.ok(DEFAULT_INQUIRIES.length >= 20);
  const slugs = DEFAULT_INQUIRIES.map((i) => i.slug);
  assert.ok(slugs.includes('nature-of-time'));
  assert.ok(slugs.includes('free-will'));
});
