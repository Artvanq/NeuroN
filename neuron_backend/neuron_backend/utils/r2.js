const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function getR2Client() {
  if (!isR2Configured()) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function buildObjectKey(userId, kind, filename) {
  const ext = (filename || 'bin').split('.').pop()?.toLowerCase() || 'bin';
  const id = crypto.randomBytes(12).toString('hex');
  return `${kind.toLowerCase()}/${userId}/${id}.${ext}`;
}

function publicUrlForKey(objectKey) {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${objectKey}`;
}

async function presignUpload({ objectKey, mimeType, sizeBytes }) {
  const client = getR2Client();
  if (!client) {
    throw new Error('R2 storage is not configured');
  }

  const maxBytes = Number(process.env.R2_MAX_UPLOAD_BYTES || 25 * 1024 * 1024);
  if (sizeBytes && sizeBytes > maxBytes) {
    throw new Error(`File too large (max ${maxBytes} bytes)`);
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  return {
    uploadUrl,
    bucket: process.env.R2_BUCKET,
    objectKey,
    publicUrl: publicUrlForKey(objectKey),
  };
}

async function verifyObjectExists(objectKey) {
  const client = getR2Client();
  if (!client) return false;
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      })
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  isR2Configured,
  buildObjectKey,
  publicUrlForKey,
  presignUpload,
  verifyObjectExists,
};
