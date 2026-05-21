const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

test('mediaStorageMode is disabled by default (text-only launch)', () => {
  const prev = {
    MEDIA_STORAGE: process.env.MEDIA_STORAGE,
    R2_BUCKET: process.env.R2_BUCKET,
  };
  delete process.env.R2_BUCKET;
  delete process.env.MEDIA_STORAGE;
  delete require.cache[require.resolve('../utils/mediaStorage')];
  const mod = require('../utils/mediaStorage');
  assert.equal(mod.mediaStorageMode(), 'disabled');
  assert.equal(mod.isMediaUploadEnabled(), false);
  if (prev.MEDIA_STORAGE) process.env.MEDIA_STORAGE = prev.MEDIA_STORAGE;
  if (prev.R2_BUCKET) process.env.R2_BUCKET = prev.R2_BUCKET;
});

test('mediaStorageMode local when explicitly configured', async () => {
  const prev = {
    MEDIA_STORAGE: process.env.MEDIA_STORAGE,
    R2_BUCKET: process.env.R2_BUCKET,
    MEDIA_LOCAL_DIR: process.env.MEDIA_LOCAL_DIR,
  };
  delete process.env.R2_BUCKET;
  process.env.MEDIA_STORAGE = 'local';
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'neuron-media-'));
  process.env.MEDIA_LOCAL_DIR = tmp;

  delete require.cache[require.resolve('../utils/mediaStorage')];
  const mod = require('../utils/mediaStorage');
  assert.equal(mod.mediaStorageMode(), 'local');
  const prepared = await mod.prepareUpload({
    userId: 'user-1',
    kind: 'AVATAR',
    filename: 'a.png',
    mimeType: 'image/png',
    mediaId: 'media-1',
  });
  assert.equal(prepared.storage, 'local');
  await mod.storeLocalUpload(prepared.objectKey, Buffer.from('png-bytes'));
  assert.equal(await mod.verifyStoredObject(prepared.objectKey), true);
  await fs.rm(tmp, { recursive: true, force: true });
  if (prev.MEDIA_STORAGE) process.env.MEDIA_STORAGE = prev.MEDIA_STORAGE;
  else delete process.env.MEDIA_STORAGE;
  if (prev.R2_BUCKET) process.env.R2_BUCKET = prev.R2_BUCKET;
  if (prev.MEDIA_LOCAL_DIR) process.env.MEDIA_LOCAL_DIR = prev.MEDIA_LOCAL_DIR;
  else delete process.env.MEDIA_LOCAL_DIR;
});
