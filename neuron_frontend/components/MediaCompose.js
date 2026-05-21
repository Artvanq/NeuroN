import { useEffect, useRef, useState } from 'react';
import { presignMedia, completeMedia, getMediaConfig, getErrorMessage } from '../lib/api';

export default function MediaCompose({ kind = 'POST', attachments, onChange, disabled }) {
  const inputRef = useRef(null);
  const [enabled, setEnabled] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMediaConfig()
      .then((cfg) => setEnabled(Boolean(cfg?.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  const uploadFile = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const presign = await presignMedia({
        kind,
        mimeType: file.type,
        filename: file.name,
        sizeBytes: file.size,
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      const completed = await completeMedia(presign.mediaId);
      onChange([
        ...(attachments || []),
        {
          mediaId: presign.mediaId,
          url: completed.publicUrl || presign.publicUrl,
          mimeType: file.type,
          name: file.name,
        },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (enabled !== true) return null;

  return (
    <div className="media-compose">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : 'Attach media'}
      </button>
      {error && <p className="error">{error}</p>}
      {attachments?.length > 0 && (
        <ul className="media-compose-list">
          {attachments.map((a) => (
            <li key={a.url}>
              {a.mimeType?.startsWith('image/') ? (
                <img src={a.url} alt={a.name || ''} className="media-compose-thumb" />
              ) : (
                <a href={a.url} target="_blank" rel="noreferrer">
                  {a.name || a.url}
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange(attachments.filter((x) => x.url !== a.url))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
