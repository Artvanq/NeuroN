import { useState } from 'react';
import { voteThreadPoll, getErrorMessage } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ThreadPoll({ threadId, poll: initialPoll, onPollChange }) {
  const router = useRouter();
  const [poll, setPoll] = useState(initialPoll);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!poll?.options?.length) return null;

  const total = poll.totalVotes || 0;
  const closed = poll.closed;
  const voted = Boolean(poll.myOptionId);

  const handleVote = async (optionId) => {
    if (closed || submitting) return;
    if (!isLoggedIn()) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { poll: next } = await voteThreadPoll(threadId, optionId);
      setPoll(next);
      onPollChange?.(next);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record vote'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="thread-poll panel-inset">
      <p className="eyebrow">Poll</p>
      {poll.endsAt && (
        <p className="muted thread-poll-meta">
          {closed ? 'Closed' : `Closes ${new Date(poll.endsAt).toLocaleString()}`}
        </p>
      )}
      <ul className="thread-poll-options">
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
          const selected = poll.myOptionId === opt._id;
          const showResults = voted || closed;
          return (
            <li key={opt._id} className={`thread-poll-option${selected ? ' selected' : ''}`}>
              {showResults ? (
                <div className="thread-poll-result">
                  <div className="thread-poll-result-head">
                    <span>{opt.label}</span>
                    <span className="muted">
                      {opt.voteCount} · {pct}%
                    </span>
                  </div>
                  <div className="thread-poll-bar" aria-hidden>
                    <span className="thread-poll-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="thread-poll-vote-btn"
                  disabled={submitting}
                  onClick={() => handleVote(opt._id)}
                >
                  {opt.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted thread-poll-meta">{total} vote{total === 1 ? '' : 's'}</p>
      {error && <p className="error">{error}</p>}
      {!voted && !closed && !isLoggedIn() && (
        <p className="muted">
          <Link href={`/login?next=${encodeURIComponent(router.asPath)}`}>Sign in</Link> to vote.
        </p>
      )}
    </div>
  );
}
