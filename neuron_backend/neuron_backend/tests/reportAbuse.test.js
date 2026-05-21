const test = require('node:test');
const assert = require('node:assert/strict');
const { decayReportAbuseScore, clampNonNegative } = require('../utils/reportAbuse');

test('clampNonNegative normalizes invalid values', () => {
  assert.equal(clampNonNegative(-5), 0);
  assert.equal(clampNonNegative('abc'), 0);
  assert.equal(clampNonNegative(4.8), 4);
});

test('decayReportAbuseScore decays by intervals', () => {
  const now = new Date('2026-05-19T22:00:00.000Z');
  const updatedAt = new Date('2026-05-17T22:00:00.000Z'); // 48h ago
  const result = decayReportAbuseScore({
    score: 7,
    updatedAt,
    now,
    decayHours: 24,
  });
  assert.equal(result.score, 5);
  assert.equal(result.changed, true);
});

test('decayReportAbuseScore does not go negative', () => {
  const now = new Date('2026-05-19T22:00:00.000Z');
  const updatedAt = new Date('2026-05-10T22:00:00.000Z');
  const result = decayReportAbuseScore({
    score: 2,
    updatedAt,
    now,
    decayHours: 24,
  });
  assert.equal(result.score, 0);
});
