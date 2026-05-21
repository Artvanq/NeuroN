import { useState } from 'react';

function commentKey(path, side, line) {
  return `${path}:${side}:${line}`;
}

export default function DiffView({ diff, path, comments = [], canComment, onAddComment }) {
  const [draftLine, setDraftLine] = useState(null);
  const [draftBody, setDraftBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!diff?.length) return <p className="muted">No diff</p>;

  const byKey = new Map();
  for (const c of comments) {
    const side = c.side || 'new';
    const key = commentKey(c.path || path, side, c.line);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(c);
  }

  const submitInline = async (side, line) => {
    if (!onAddComment || !draftBody.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment({ path, side, line, body: draftBody.trim() });
      setDraftLine(null);
      setDraftBody('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <pre className="diff-view">
      {diff.map((line, i) => {
        const side = line.type === 'remove' ? 'old' : 'new';
        const lineNum = line.type === 'remove' ? line.oldNum : line.newNum;
        const key = lineNum ? commentKey(path, side, lineNum) : null;
        const lineComments = key ? byKey.get(key) || [] : [];
        const isDraft =
          draftLine &&
          draftLine.path === path &&
          draftLine.side === side &&
          draftLine.line === lineNum;

        return (
          <div key={`${line.type}-${i}`} className="diff-line-wrap">
            <div
              className={`diff-line diff-${line.type}${canComment && lineNum ? ' diff-line-clickable' : ''}`}
              onClick={() => {
                if (!canComment || !lineNum) return;
                setDraftLine({ path, side, line: lineNum });
                setDraftBody('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canComment && lineNum) {
                  setDraftLine({ path, side, line: lineNum });
                  setDraftBody('');
                }
              }}
              role={canComment && lineNum ? 'button' : undefined}
              tabIndex={canComment && lineNum ? 0 : undefined}
            >
              <span className="diff-gutter">
                {line.oldNum || ''}
                {line.oldNum && line.newNum ? ' ' : ''}
                {line.newNum || ''}
              </span>
              <span className="diff-sign">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <span className="diff-text">{line.text}</span>
              {lineComments.length > 0 && (
                <span className="diff-comment-count">{lineComments.length}</span>
              )}
            </div>
            {lineComments.map((c) => (
              <div key={c._id} className="diff-inline-comment panel-inset">
                <p className="meta">
                  <strong>{c.author?.username}</strong> · {c.side}:{c.line}
                </p>
                <p>{c.body}</p>
              </div>
            ))}
            {isDraft && (
              <div className="diff-inline-form panel-inset">
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={2}
                  placeholder="Inline comment…"
                  autoFocus
                />
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={submitting || !draftBody.trim()}
                    onClick={() => submitInline(side, lineNum)}
                  >
                    Comment
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDraftLine(null);
                      setDraftBody('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </pre>
  );
}
