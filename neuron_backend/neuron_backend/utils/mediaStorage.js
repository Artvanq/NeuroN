const path = require('path');
const fs = require('fs/promises');
const {
  isR2Configured,
  buildObjectKey,
  presignUpload,
  verifyObjectExists,
  publicUrlForKey,
} = require('./r2');

function mediaStorageMode() {
  const forced = String(process.env.MEDIA_STORAGE || 'disabled').toLowerCase();
  if (['disabled', 'off', 'none', 'false'].includes(forced)) return 'disabled';
  if (forced === 'r2') return isR2Configured() ? 'r2' : 'disabled';
  if (forced === 'local') return 'local';
  if (isR2Configured()) return 'r2';
  return 'disabled';
}

function isMediaUploadEnabled() {
  return mediaStorageMode() !== 'disabled';
}

function getMediaRoot() {
  return path.resolve(process.env.MEDIA_LOCAL_DIR || './data/media');
}

function apiPublicBase() {
  return (process.env.API_PUBLIC_URL || 'http://localhost:4000').replace(/\/$/, '');
}

function localPublicUrl(objectKey) {
  const encoded = objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${apiPublicBase()}/api/media/files/${encoded}`;
}

function resolveLocalPath(objectKey) {
  const root = getMediaRoot();
  const resolved = path.resolve(root, objectKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid media path');
  }
  return resolved;
}

async function ensureMediaRoot() {
  await fs.mkdir(getMediaRoot(), { recursive: true });
}

async function prepareUpload({ userId, kind, filename, mimeType, sizeBytes, mediaId }) {
  const objectKey = buildObjectKey(userId, kind, filename);
  const mode = mediaStorageMode();

  if (mode === 'r2') {
    const signed = await presignUpload({ objectKey, mimeType, sizeBytes });
    return {
      storage: 'r2',
      bucket: signed.bucket,
      objectKey: signed.objectKey,
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
    };
  }

  if (mode === 'local') {
    await ensureMediaRoot();
    return {
      storage: 'local',
      bucket: 'local',
      objectKey,
      uploadUrl: `${apiPublicBase()}/api/media/${mediaId}/upload`,
      publicUrl: localPublicUrl(objectKey),
    };
  }

  throw new Error('Media storage is not configured');
}

async function storeLocalUpload(objectKey, body) {
  const filePath = resolveLocalPath(objectKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
}

async function verifyStoredObject(objectKey) {
  const mode = mediaStorageMode();
  if (mode === 'r2') return verifyObjectExists(objectKey);
  if (mode === 'local') {
    try {
      const stat = await fs.stat(resolveLocalPath(objectKey));
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  }
  return false;
}

function resolvePublicUrl(media) {
  if (media.publicUrl) return media.publicUrl;
  if (mediaStorageMode() === 'r2') return publicUrlForKey(media.objectKey);
  if (mediaStorageMode() === 'local') return localPublicUrl(media.objectKey);
  return null;
}

async function readLocalFile(objectKey) {
  return fs.readFile(resolveLocalPath(objectKey));
}

module.exports = {
  mediaStorageMode,
  isMediaUploadEnabled,
  getMediaRoot,
  prepareUpload,
  storeLocalUpload,
  verifyStoredObject,
  resolvePublicUrl,
  readLocalFile,
  resolveLocalPath,
};
