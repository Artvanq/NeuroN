import { useState } from 'react';
import { sendMessageRequest, getErrorMessage } from '../lib/api';

export default function MessageRequestModal({ username, onClose, onSent }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sendMessageRequest({ username, body: body.trim() });
      onSent?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className="notif-backdrop" aria-label="Close" onClick={onClose} />
      <form className="report-modal panel" onSubmit={submit}>
        <h3>Request dialogue</h3>
        <p className="muted">
          This mind accepts messages only after a short introduction — like a partial-open profile.
        </p>
        {error && <p className="error">{error}</p>}
        <label>
          Your message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Why you want to connect…"
            required
            maxLength={500}
          />
        </label>
        <div className="emergence-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
