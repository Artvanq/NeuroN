const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE_PATH = '../utils/mediaScan';

function withEnv(env, fn) {
  const original = { ...process.env };
  Object.assign(process.env, env);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Object.keys(env).forEach((k) => {
        if (original[k] === undefined) delete process.env[k];
        else process.env[k] = original[k];
      });
    });
}

test('verifyUploadedMedia skips when scanner is disabled', async () => {
  await withEnv({ MEDIA_SCAN_URL: '' }, async () => {
    delete require.cache[require.resolve(MODULE_PATH)];
    const { verifyUploadedMedia } = require(MODULE_PATH);
    const result = await verifyUploadedMedia({ id: 'm1' });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });
});

test('verifyUploadedMedia returns reject reason from scanner', async () => {
  await withEnv({ MEDIA_SCAN_URL: 'https://scan.local/test' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: false, reason: 'malware' }),
    });
    try {
      delete require.cache[require.resolve(MODULE_PATH)];
      const { verifyUploadedMedia } = require(MODULE_PATH);
      const result = await verifyUploadedMedia({
        id: 'm1',
        bucket: 'b',
        objectKey: 'k',
        mimeType: 'image/png',
      });
      assert.equal(result.ok, false);
      assert.match(result.reason, /malware/i);
    } finally {
      global.fetch = originalFetch;
      delete require.cache[require.resolve(MODULE_PATH)];
    }
  });
});
