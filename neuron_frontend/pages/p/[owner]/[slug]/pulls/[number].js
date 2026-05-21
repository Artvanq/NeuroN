import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import ProjectNav from '../../../../../components/ProjectNav';
import Loading from '../../../../../components/Loading';
import TranslatableMarkdown from '../../../../../components/TranslatableMarkdown';
import DiffView from '../../../../../components/DiffView';
import {
  getPullRequest,
  mergePullRequest,
  updatePullRequest,
  submitPullRequestReview,
  createPullRequestReviewComment,
  deletePullRequestReviewComment,
  getErrorMessage,
} from '../../../../../lib/api';
import { useI18n } from '../../../../../lib/I18nContext';
import { isLoggedIn } from '../../../../../lib/auth';

export default function PullRequestPage() {
  const router = useRouter();
  const { owner, slug, number } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewBody, setReviewBody] = useState('');
  const [mergeMethod, setMergeMethod] = useState('merge');

  const base = owner && slug ? `/p/${owner}/${slug}` : '';

  const load = () => {
    if (!owner || !slug || !number) return;
    setLoading(true);
    getPullRequest(owner, slug, number)
      .then((data) => {
        setProject(data.project);
        setPr(data.pullRequest);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [owner, slug, number]);

  const canMerge = project?.viewerPermissions?.merge;
  const canReview = isLoggedIn() && pr?.status === 'open';

  const handleMerge = async () => {
    setBusy(true);
    setError(null);
    try {
      const merged = await mergePullRequest(owner, slug, number, { mergeMethod });
      setPr(merged);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      const updated = await updatePullRequest(owner, slug, number, { status: 'closed' });
      setPr(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (state) => {
    setBusy(true);
    setError(null);
    try {
      await submitPullRequestReview(owner, slug, number, {
        state,
        body: reviewBody,
      });
      setReviewBody('');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !pr) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  if (!pr) {
    return (
      <Layout>
        <p className="error">{error || t('pr_not_found')}</p>
      </Layout>
    );
  }

  return (
    <Layout title={`#${pr.number} ${pr.title}`} wide>
      {project && <ProjectNav owner={owner} slug={slug} project={project} />}

      <article className="panel pr-detail">
        <div className="pr-detail-head">
          <span className={`pr-status-badge ${pr.status}`}>{pr.status}</span>
          {pr.isDraft && <span className="issue-status-badge closed">draft</span>}
          <h1>
            <span className="issue-number">#{pr.number}</span> {pr.title}
          </h1>
          <p className="meta">
            {pr.author?.username} · {new Date(pr.createdAt).toLocaleString()}
          </p>
          {(pr.baseBranch || pr.headBranch) && (
            <p className="muted">
              {pr.headBranch ? (
                <>
                  <code>{pr.headBranch}</code> → <code>{pr.baseBranch || 'main'}</code>
                </>
              ) : (
                <code>{pr.baseBranch || 'main'}</code>
              )}
            </p>
          )}
          {pr.status === 'open' && pr.mergeChecks && (
            <div className="panel-inset pr-merge-checks">
              <p className={pr.mergeable ? 'success' : 'muted'}>
                {pr.mergeable ? t('pr_mergeable') : t('pr_not_mergeable')}
              </p>
              <ul className="muted">
                {pr.mergeChecks.ci?.required && (
                  <li>
                    CI: {pr.mergeChecks.ci.ok ? t('pr_check_ok') : pr.mergeChecks.ci.status}
                  </li>
                )}
                {pr.mergeChecks.reviews?.required && (
                  <li>
                    {t('pr_check_reviews')}: {pr.mergeChecks.reviews.approvals}/
                    {pr.mergeChecks.reviews.requiredCount}
                    {pr.mergeChecks.reviews.changesRequested ? ` · ${t('pr_changes_requested')}` : ''}
                  </li>
                )}
                {pr.mergeChecks.draft?.required && !pr.mergeChecks.draft.ok && (
                  <li>Mark pull request ready for review (currently draft)</li>
                )}
              </ul>
            </div>
          )}
          <div className="actions-row">
            {canMerge && pr.status === 'open' && (
              <>
                <select
                  className="btn btn-ghost btn-sm"
                  value={mergeMethod}
                  onChange={(e) => setMergeMethod(e.target.value)}
                  disabled={busy}
                  aria-label="Merge method"
                >
                  <option value="merge">Merge commit</option>
                  <option value="squash">Squash and merge</option>
                  <option value="rebase">Rebase and merge</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleMerge}
                  disabled={busy || pr.mergeable === false}
                >
                  {t('pr_merge')}
                </button>
              </>
            )}
            {pr.status === 'open' && pr.isDraft && isLoggedIn() && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const updated = await updatePullRequest(owner, slug, number, { isDraft: false });
                    setPr(updated);
                  } catch (err) {
                    setError(getErrorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Mark ready for review
              </button>
            )}
            {pr.status === 'open' && isLoggedIn() && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleClose} disabled={busy}>
                {t('pr_close')}
              </button>
            )}
            <Link href={`${base}/code`} className="btn btn-ghost btn-sm">
              {t('project_tab_code')}
            </Link>
          </div>
        </div>

        {pr.body && (
          <div className="pr-body">
            <TranslatableMarkdown text={pr.body} />
          </div>
        )}

        {pr.changes?.map((change) => (
          <section key={change._id} className="pr-change panel">
            <h3 className="pr-change-path">
              <span className={`pr-change-action ${change.action}`}>{change.action}</span>
              {change.path}
            </h3>
            <p className="muted">Click a changed line to leave an inline comment.</p>
            <DiffView
              diff={change.diff}
              path={change.path}
              comments={(pr.reviewComments || []).filter((c) => c.path === change.path)}
              canComment={canReview}
              onAddComment={async (payload) => {
                const created = await createPullRequestReviewComment(
                  owner,
                  slug,
                  number,
                  payload
                );
                setPr((prev) =>
                  prev
                    ? {
                        ...prev,
                        reviewComments: [...(prev.reviewComments || []), created],
                      }
                    : prev
                );
              }}
            />
          </section>
        ))}

        {pr.reviewComments?.length > 0 && (
          <section className="panel-inset">
            <h2>Inline comments</h2>
            <ul className="invite-list">
              {pr.reviewComments.map((c) => (
                <li key={c._id}>
                  <code>
                    {c.path}:{c.side}:{c.line}
                  </code>{' '}
                  — <strong>{c.author?.username}</strong>: {c.body}
                  {c.canDelete && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={async () => {
                        await deletePullRequestReviewComment(owner, slug, number, c._id);
                        setPr((prev) =>
                          prev
                            ? {
                                ...prev,
                                reviewComments: prev.reviewComments.filter(
                                  (x) => x._id !== c._id
                                ),
                              }
                            : prev
                        );
                      }}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pr.reviews && pr.reviews.length > 0 && (
          <section className="panel-inset">
            <h2>{t('pr_reviews_title')}</h2>
            <ul className="invite-list">
              {pr.reviews.map((r) => (
                <li key={r._id}>
                  <strong>{r.reviewer?.username}</strong> · {r.state}
                  {r.body && <p className="muted">{r.body}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {canReview && (
          <section className="panel-inset">
            <h2>{t('pr_review_submit')}</h2>
            <textarea
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              placeholder={t('pr_review_placeholder')}
              rows={3}
            />
            <div className="emergence-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => submitReview('APPROVED')}
              >
                {t('pr_review_approve')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => submitReview('CHANGES_REQUESTED')}
              >
                {t('pr_review_request_changes')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => submitReview('COMMENTED')}
              >
                {t('pr_review_comment')}
              </button>
            </div>
          </section>
        )}
      </article>

      {error && <p className="error">{error}</p>}
    </Layout>
  );
}
