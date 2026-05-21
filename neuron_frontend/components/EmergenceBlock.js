import { useState, useEffect, useMemo } from 'react';
import { getSynthesis, updateSynthesis, getErrorMessage } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import TranslatableText from './TranslatableText';

export default function EmergenceBlock({ threadId, replyCount, participantSignals }) {
  const [synthesis, setSynthesis] = useState(null);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!threadId) return;
    getSynthesis(threadId)
      .then((data) => {
        setSynthesis(data);
        setContent(data.content || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [threadId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateSynthesis(threadId, content);
      setSynthesis(data);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save emergence'));
    } finally {
      setSaving(false);
    }
  };

  const contributors = synthesis?.contributors || [];
  const hasContent = Boolean(synthesis?.content?.trim());
  const uniqueVoices = participantSignals?.uniqueVoices || 0;
  const topContributors = participantSignals?.topContributors || [];

  const ritual = useMemo(
    () => [
      {
        id: 'spark',
        label: 'Spark',
        done: replyCount >= 1,
        hint: 'Someone answered with a non-obvious perspective.',
      },
      {
        id: 'divergence',
        label: 'Divergence',
        done: uniqueVoices >= 3,
        hint: 'At least 3 distinct minds challenge each other.',
      },
      {
        id: 'draft',
        label: 'Draft',
        done: hasContent,
        hint: 'A first synthesis draft is written.',
      },
      {
        id: 'convergence',
        label: 'Convergence',
        done: hasContent && contributors.length >= 2,
        hint: 'Multiple minds refine one shared statement.',
      },
      {
        id: 'seal',
        label: 'Seal',
        done: hasContent && uniqueVoices >= 4 && replyCount >= 8,
        hint: 'The collision has enough depth to become doctrine.',
      },
    ],
    [contributors.length, hasContent, replyCount, uniqueVoices]
  );

  const completedSteps = ritual.filter((s) => s.done).length;

  if (loading) {
    return (
      <section className="emergence-panel emergence-loading">
        <p className="muted">Loading emergence…</p>
      </section>
    );
  }

  return (
    <section className="emergence-panel">
      <div className="emergence-header">
        <div>
          <p className="eyebrow">Cognitive synesthesia</p>
          <h2 className="emergence-title">Shared emergence</h2>
          <p className="emergence-desc">
            A thought none of you could create alone — co-shaped by every mind in
            this collision.
          </p>
        </div>
        <div className="emergence-metrics" aria-label="Collision metrics">
          <div>
            <strong>{replyCount}</strong>
            <span>responses</span>
          </div>
          <div>
            <strong>{uniqueVoices}</strong>
            <span>voices</span>
          </div>
          <div>
            <strong>{completedSteps}/5</strong>
            <span>ritual</span>
          </div>
        </div>
        {isLoggedIn() && replyCount > 0 && !editing && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing(true)}
          >
            {hasContent ? 'Refine' : 'Begin emergence'}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <ol className="emergence-ritual">
        {ritual.map((step) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            <span className="step-mark" aria-hidden>
              {step.done ? '●' : '○'}
            </span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      {editing ? (
        <div className="emergence-edit">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Distill what emerged from the collision of perspectives…"
          />
          <div className="emergence-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save emergence'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(false);
                setContent(synthesis?.content || '');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasContent ? (
        <>
          <div className="emergence-content">
            <TranslatableText text={synthesis.content} as="span" />
          </div>
          {contributors.length > 0 && (
            <p className="emergence-contributors">
              Shaped by{' '}
              {contributors
                .map((c) => c.displayName || c.username)
                .join(', ')}
              {synthesis.updatedAt && (
                <> · updated {new Date(synthesis.updatedAt).toLocaleDateString()}</>
              )}
            </p>
          )}
          {topContributors.length > 0 && (
            <div className="emergence-ledger">
              <p className="emergence-ledger-title">Collision ledger</p>
              <ul>
                {topContributors.slice(0, 5).map((row) => (
                  <li key={row.username}>
                    <span>{row.displayName || row.username}</span>
                    <span>{row.count} response{row.count === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="muted emergence-empty">
          {replyCount < 2
            ? 'Needs more collisions before emergence can form — invite another mind.'
            : isLoggedIn()
              ? 'Respond first, then help distill what emerged together.'
              : 'Sign in and respond to help shape what emerges.'}
        </p>
      )}
    </section>
  );
}
