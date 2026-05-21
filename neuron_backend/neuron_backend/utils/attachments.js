function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || item.publicUrl || '').trim();
      if (!url) return null;
      return {
        mediaId: item.mediaId ? String(item.mediaId) : null,
        url,
        mimeType: item.mimeType ? String(item.mimeType) : null,
        name: item.name ? String(item.name).slice(0, 200) : null,
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

module.exports = { normalizeAttachments };
