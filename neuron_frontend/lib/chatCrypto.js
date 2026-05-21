const ENC_PREFIX = 'enc:v1:';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes) {
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

async function importKey(groupKeyBase64) {
  const raw = b64ToBytes(groupKeyBase64);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export function generateGroupKeyBase64() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToB64(bytes);
}

export async function encryptMessage(plaintext, groupKeyBase64) {
  const key = await importKey(groupKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const payload = {
    iv: bytesToB64(new Uint8Array(iv)),
    ct: bytesToB64(new Uint8Array(cipher)),
  };
  return `${ENC_PREFIX}${btoa(JSON.stringify(payload))}`;
}

export async function decryptMessage(payload, groupKeyBase64) {
  if (!payload?.startsWith(ENC_PREFIX)) return payload;
  try {
    const key = await importKey(groupKeyBase64);
    const { iv, ct } = JSON.parse(atob(payload.slice(ENC_PREFIX.length)));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(iv) },
      key,
      b64ToBytes(ct)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '[Unable to decrypt]';
  }
}

export function isEncryptedPayload(body) {
  return typeof body === 'string' && body.startsWith(ENC_PREFIX);
}

const keyCache = new Map();

export function cacheGroupKey(conversationId, groupKeyBase64) {
  keyCache.set(String(conversationId), groupKeyBase64);
}

export function getCachedGroupKey(conversationId) {
  return keyCache.get(String(conversationId)) || null;
}
