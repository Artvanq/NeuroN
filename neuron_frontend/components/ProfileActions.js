import { useState } from 'react';
import { useRouter } from 'next/router';
import ReportButton from './ReportButton';
import MessageRequestModal from './MessageRequestModal';
import {
  createConversation,
  blockUser,
  unblockUser,
  getErrorMessage,
} from '../lib/api';
import { isLoggedIn } from '../lib/auth';

export default function ProfileActions({ user, onBlockChange }) {
  const router = useRouter();
  const [messaging, setMessaging] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState(null);
  const [showRequest, setShowRequest] = useState(false);

  if (!user?.access || user.access.isSelf) return null;

  const { access } = user;

  const startChat = async () => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    setMessaging(true);
    setError(null);
    try {
      const conv = await createConversation({ username: user.username });
      router.push(`/messages/${conv._id}`);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'request_required') {
        setShowRequest(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setMessaging(false);
    }
  };

  const toggleBlock = async () => {
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    setBlocking(true);
    setError(null);
    try {
      if (access.blocked) {
        await unblockUser(user._id);
        onBlockChange?.({ ...access, blocked: false });
      } else {
        await blockUser({ username: user.username });
        onBlockChange?.({ ...access, blocked: true, canMessage: false, canViewContent: false });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBlocking(false);
    }
  };

  let messageLabel = 'Start dialogue';
  if (access.hasPendingRequest) messageLabel = 'Request pending';
  if (access.messageAccessCode === 'closed') messageLabel = 'Messages closed';
  if (access.blocked || access.blockedBy) messageLabel = 'Unavailable';

  return (
    <div className="profile-actions">
      {error && <p className="error">{error}</p>}

      {access.canMessage && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={startChat}
          disabled={messaging}
        >
          {messaging ? 'Opening…' : messageLabel}
        </button>
      )}

      {!access.canMessage &&
        access.messageAccessCode === 'request_required' &&
        !access.hasPendingRequest && (
          <button type="button" className="btn btn-primary" onClick={() => setShowRequest(true)}>
            Request dialogue
          </button>
        )}

      {access.hasPendingRequest && (
        <span className="muted profile-badge">Request sent — waiting for reply</span>
      )}

      {access.profileVisibility === 'CLOSED' && !access.isSelf && (
        <span className="muted profile-badge">Closed profile</span>
      )}

      {isLoggedIn() && (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={toggleBlock}
            disabled={blocking}
          >
            {blocking ? '…' : access.blocked ? 'Unblock' : 'Block'}
          </button>
          <ReportButton targetType="user" targetId={user._id} />
        </>
      )}

      {showRequest && (
        <MessageRequestModal
          username={user.username}
          onClose={() => setShowRequest(false)}
          onSent={() =>
            onBlockChange?.({
              ...access,
              hasPendingRequest: true,
              canMessage: false,
            })
          }
        />
      )}
    </div>
  );
}
