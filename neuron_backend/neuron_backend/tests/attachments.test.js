const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAttachments } = require('../utils/attachments');

test('normalizeAttachments filters invalid and caps count', () => {
  const out = normalizeAttachments([
    { url: 'https://cdn.example/a.png', mimeType: 'image/png' },
    { url: '' },
    null,
    { publicUrl: 'https://cdn.example/b.pdf', name: 'doc.pdf' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://cdn.example/a.png');
  assert.equal(out[1].name, 'doc.pdf');
});
