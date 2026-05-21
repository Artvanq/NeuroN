const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('worker entrypoints exist and parse', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['workers/analyticsWorker.js', 'workers/digestWorker.js']) {
    const full = path.join(root, file);
    assert.ok(fs.existsSync(full), `${file} should exist`);
    const src = fs.readFileSync(full, 'utf8');
    assert.ok(src.includes('worker'), `${file} should identify as worker`);
  }
});
