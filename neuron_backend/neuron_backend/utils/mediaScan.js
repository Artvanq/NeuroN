function scanIsEnabled() {
  return Boolean(String(process.env.MEDIA_SCAN_URL || '').trim());
}

function resolveScanTimeoutMs() {
  const raw = Number(process.env.MEDIA_SCAN_TIMEOUT_MS || 6000);
  if (!Number.isFinite(raw) || raw < 500) return 6000;
  return Math.floor(raw);
}

async function verifyUploadedMedia(media) {
  if (!scanIsEnabled()) return { ok: true, skipped: true };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolveScanTimeoutMs());

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.MEDIA_SCAN_TOKEN) {
      headers.Authorization = `Bearer ${process.env.MEDIA_SCAN_TOKEN}`;
    }
    const response = await fetch(process.env.MEDIA_SCAN_URL, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        bucket: media.bucket,
        objectKey: media.objectKey,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        kind: media.kind,
        mediaId: media.id,
      }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Scanner request failed (${response.status})` };
    }

    const data = await response.json().catch(() => ({}));
    if (data?.ok === false) {
      return { ok: false, reason: data.reason || 'Scanner rejected file' };
    }
    return { ok: true };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'Scanner timeout' : 'Scanner unavailable';
    return { ok: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  scanIsEnabled,
  verifyUploadedMedia,
};
