import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import Loading from '../../../../../components/Loading';
import TranslatableMarkdown from '../../../../../components/TranslatableMarkdown';
import {
  getIssue,
  updateIssue,
  getIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  getErrorMessage,
} from '../../../../../lib/api';
import { useI18n } from '../../../../../lib/I18nContext';
import { isLoggedIn, getStoredUser } from '../../../../../lib/auth';

export default function IssuePage() {
  const router = useRouter();
  const { owner, slug, number } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [projectLabels, setProjectLabels] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [assigneeCandidates, setAssigneeCandidates] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editBody, setEditBody] = useState('');

  const base = owner && slug ? `/p/${owner}/${slug}` : '';

  const load = () => {
    if (!owner || !slug || !number) return;
    setLoading(true);
    getIssue(owner, slug, number)
      .then((data) => {
        setProject(data.project);
        setIssue(data.issue);
        setProjectLabels(data.labels || []);
        setMilestones(data.milestones || []);
        setAssigneeCandidates(data.assigneeCandidates || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  const loadComments = () => {
    if (!owner || !slug || !number) return;
    getIssueComments(owner, slug, number)
      .then(setComments)
      .catch(() => setComments([]));
  };

  useEffect(() => {
    load();
    loadComments();
  }, [owner, slug, number]);

  const toggleStatus = async () => {
    if (!issue || !isLoggedIn()) return;
    setBusy(true);
    try {
      const next = issue.status === 'open' ? 'closed' : 'open';
      const updated = await updateIssue(owner, slug, number, { status: next });
      setIssue(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const user = getStoredUser();
  const canToggle =
    user &&
    issue &&
    (user.username === project?.ownerUsername ||
      user._id === issue.author?._id ||
      user.username === issue.author?.username);

  if (loading && !issue) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  if (!issue) {
    return (
      <Layout>
        <p className="error">{error || t('issue_not_found')}</p>
      </Layout>
    );
  }

  return (
    <Layout title={`#${issue.number} ${issue.title}`} wide>
      <p className="eyebrow">
        <Link href={base}>
          {owner}/{slug}
        </Link>
      </p>

      <article className="panel issue-detail">
        <div className="issue-detail-head">
          <span className={`issue-status-badge ${issue.status}`}>{issue.status}</span>
          <h1>
            <span className="issue-number">#{issue.number}</span> {issue.title}
          </h1>
          <p className="meta">
            {t('issue_opened_by')}{' '}
            <Link href={`/u/${issue.author?.username}`}>{issue.author?.displayName || issue.author?.username}</Link>
            {' · '}
            {new Date(issue.createdAt).toLocaleString()}
          </p>
          {(issue.milestone || issue.assignees?.length > 0) && (
            <p className="meta">
              {issue.milestone && (
                <>
                  Milestone: <strong>{issue.milestone.title}</strong>
                </>
              )}
              {issue.assignees?.length > 0 && (
                <>
                  {issue.milestone ? ' · ' : ''}
                  Assignees:{' '}
                  {issue.assignees.map((a, i) => (
                    <span key={a._id}>
                      {i > 0 ? ', ' : ''}
                      <Link href={`/u/${a.username}`}>{a.displayName || a.username}</Link>
                    </span>
                  ))}
                </>
              )}
            </p>
          )}
          {isLoggedIn() && milestones.length > 0 && (
            <div className="issue-label-editor panel">
              <p className="muted">Milestone</p>
              <select
                value={issue.milestone?._id || ''}
                disabled={busy}
                onChange={async (e) => {
                  setBusy(true);
                  try {
                    const updated = await updateIssue(owner, slug, number, {
                      milestoneId: e.target.value || null,
                    });
                    setIssue(updated);
                  } catch (err) {
                    setError(getErrorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="">No milestone</option>
                {milestones.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isLoggedIn() && assigneeCandidates.length > 0 && (
            <div className="issue-label-editor panel">
              <p className="muted">Assignees</p>
              <div className="issue-label-chips">
                {assigneeCandidates.map((a) => {
                  const active = issue.assignees?.some((x) => x._id === a._id);
                  return (
                    <button
                      key={a._id}
                      type="button"
                      className={`issue-label-chip${active ? ' active' : ''}`}
                      disabled={busy}
                      onClick={async () => {
                        const current = (issue.assignees || []).map((x) => x._id);
                        const next = active
                          ? current.filter((id) => id !== a._id)
                          : [...current, a._id];
                        setBusy(true);
                        try {
                          const updated = await updateIssue(owner, slug, number, {
                            assigneeIds: next,
                          });
                          setIssue(updated);
                        } catch (err) {
                          setError(getErrorMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      @{a.username}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {issue.labels?.length > 0 && (
            <p className="issue-label-chips">
              {issue.labels.map((l) => (
                <span
                  key={l._id}
                  className="issue-label-chip"
                  style={{ borderColor: l.color, color: l.color }}
                >
                  {l.name}
                </span>
              ))}
            </p>
          )}
          {isLoggedIn() && projectLabels.length > 0 && (
            <div className="issue-label-editor panel">
              <p className="muted">Labels</p>
              <div className="issue-label-chips">
                {projectLabels.map((l) => {
                  const active = issue.labels?.some((x) => x._id === l._id);
                  return (
                    <button
                      key={l._id}
                      type="button"
                      className={`issue-label-chip${active ? ' active' : ''}`}
                      style={{ borderColor: l.color, color: l.color }}
                      disabled={busy}
                      onClick={async () => {
                        const current = (issue.labels || []).map((x) => x._id);
                        const next = active
                          ? current.filter((id) => id !== l._id)
                          : [...current, l._id];
                        setBusy(true);
                        try {
                          const updated = await updateIssue(owner, slug, number, { labelIds: next });
                          setIssue(updated);
                        } catch (err) {
                          setError(getErrorMessage(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="actions-row">
            {canToggle && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleStatus}
                disabled={busy}
              >
                {issue.status === 'open' ? t('issue_close') : t('issue_reopen')}
              </button>
            )}
            {issue.threadId && (
              <Link href={`/t/${issue.threadId}`} className="btn btn-ghost btn-sm">
                {t('issue_discussion')}
              </Link>
            )}
          </div>
        </div>

        {issue.body && (
          <div className="issue-body">
            <TranslatableMarkdown text={issue.body} />
          </div>
        )}
      </article>

      <section className="panel issue-comments">
        <h2>
          Comments
          {typeof issue.commentCount === 'number' ? ` (${issue.commentCount})` : ''}
        </h2>
        {comments.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          <ul className="reply-list">
            {comments.map((c) => (
              <li key={c._id} id={`comment-${c._id}`} className="reply-item">
                <p className="meta">
                  <Link href={`/u/${c.author?.username}`}>
                    {c.author?.displayName || c.author?.username}
                  </Link>
                  {' · '}
                  {new Date(c.createdAt).toLocaleString()}
                  {c.updatedAt && c.updatedAt !== c.createdAt && ' (edited)'}
                </p>
                {editingCommentId === c._id ? (
                  <form
                    className="form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editBody.trim()) return;
                      setBusy(true);
                      try {
                        const updated = await updateIssueComment(
                          owner,
                          slug,
                          number,
                          c._id,
                          editBody.trim()
                        );
                        setComments((prev) =>
                          prev.map((x) => (x._id === c._id ? updated : x))
                        );
                        setEditingCommentId(null);
                        setEditBody('');
                      } catch (err) {
                        setError(getErrorMessage(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                      required
                    />
                    <div className="actions-row">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditBody('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <TranslatableMarkdown text={c.body} />
                )}
                {isLoggedIn() && editingCommentId !== c._id && (c.canEdit || c.canDelete) && (
                  <div className="actions-row">
                    {c.canEdit && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setEditingCommentId(c._id);
                          setEditBody(c.body);
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {c.canDelete && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={async () => {
                          if (!window.confirm('Delete this comment?')) return;
                          setBusy(true);
                          try {
                            await deleteIssueComment(owner, slug, number, c._id);
                            setComments((prev) => prev.filter((x) => x._id !== c._id));
                            setIssue((prev) =>
                              prev && typeof prev.commentCount === 'number'
                                ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) }
                                : prev
                            );
                          } catch (err) {
                            setError(getErrorMessage(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {isLoggedIn() ? (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentBody.trim()) return;
              setBusy(true);
              try {
                const created = await createIssueComment(
                  owner,
                  slug,
                  number,
                  commentBody.trim()
                );
                setComments((prev) => [...prev, created]);
                setCommentBody('');
                setIssue((prev) =>
                  prev
                    ? {
                        ...prev,
                        commentCount:
                          (typeof prev.commentCount === 'number' ? prev.commentCount : comments.length) +
                          1,
                      }
                    : prev
                );
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Add a comment
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={4}
                placeholder={t('markdown_hint')}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Comment
            </button>
          </form>
        ) : (
          <p className="muted">
            <Link href={`/login?next=${encodeURIComponent(router.asPath)}`}>Sign in</Link> to comment.
          </p>
        )}
      </section>

      {error && <p className="error">{error}</p>}
    </Layout>
  );
}
