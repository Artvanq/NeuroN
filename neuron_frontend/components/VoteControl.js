import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { castVote, getErrorMessage } from '../lib/api';
import { isLoggedIn } from '../lib/auth';

function formatScore(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export default function VoteControl({
  targetType,
  targetId,
  score: initialScore = 0,
  myVote: initialMyVote = null,
  layout = 'column',
  onUpdate,
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScore(initialScore);
    setMyVote(initialMyVote);
  }, [initialScore, initialMyVote, targetId]);

  const handleVote = async (value) => {
    if (!isLoggedIn()) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (busy) return;

    setBusy(true);
    try {
      const nextValue = myVote === value ? 0 : value;
      const data = await castVote({ targetType, targetId, value: nextValue });
      setScore(data.score);
      setMyVote(data.myVote);
      onUpdate?.(data);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(getErrorMessage(err, 'Vote failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`vote-control vote-control-${layout}${busy ? ' busy' : ''}`}
      aria-label="Vote"
    >
      <button
        type="button"
        className={`vote-btn up${myVote === 1 ? ' active' : ''}`}
        onClick={() => handleVote(1)}
        disabled={busy}
        aria-pressed={myVote === 1}
        title="Upvote"
      >
        ▲
      </button>
      <span className={`vote-score${score > 0 ? ' positive' : ''}${score < 0 ? ' negative' : ''}`}>
        {formatScore(score)}
      </span>
      <button
        type="button"
        className={`vote-btn down${myVote === -1 ? ' active' : ''}`}
        onClick={() => handleVote(-1)}
        disabled={busy}
        aria-pressed={myVote === -1}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
