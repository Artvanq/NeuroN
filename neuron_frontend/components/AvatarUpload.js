import { useRef, useState, useEffect } from 'react';
import { presignMedia, completeMedia, getMe, getErrorMessage } from '../lib/api';
import { updateStoredUser } from '../lib/auth';

export default function AvatarUpload({ avatarUrl, onUpdated }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(avatarUrl || null);

  useEffect(() => {
    setPreview(avatarUrl || null);
  }, [avatarUrl]);

  const uploadFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPEG, PNG, WebP, or GIF image');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const presign = await presignMedia({
        kind: 'AVATAR',
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
      const url = completed.publicUrl || presign.publicUrl;
      setPreview(url);
      const me = await getMe();
      updateStoredUser(me);
      onUpdated?.(me);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-upload">
      <div className="avatar-upload-preview">
        {preview ? (
          <img src={preview} alt="" className="profile-avatar" width={72} height={72} />
        ) : (
          <div className="avatar-upload-placeholder" aria-hidden>
            ?
          </div>
        )}
      </div>
      <div className="avatar-upload-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
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
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : preview ? 'Change photo' : 'Upload photo'}
        </button>
        <p className="muted">Square images work best. Max size follows media limits.</p>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
