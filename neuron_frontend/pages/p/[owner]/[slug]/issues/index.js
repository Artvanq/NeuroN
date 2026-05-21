import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import ProjectNav from '../../../../../components/ProjectNav';
import Loading from '../../../../../components/Loading';
import { getProjectIssues, getErrorMessage } from '../../../../../lib/api';
import { useI18n } from '../../../../../lib/I18nContext';
import { isLoggedIn } from '../../../../../lib/auth';

function IssueCard({ issue, base, t }) {
  return (
    <Link href={`${base}/issues/${issue.number}`} className="issue-kanban-card">
      <span className="issue-kanban-card-title">{issue.title}</span>
      {issue.labels?.length > 0 && (
        <span className="issue-label-chips">
          {issue.labels.map((l) => (
            <span
              key={l._id}
              className="issue-label-chip"
              style={{ borderColor: l.color, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </span>
      )}
      <span className="issue-list-meta muted">
        #{issue.number} · {issue.author?.username}
      </span>
    </Link>
  );
}

function IssueListRow({ issue, base, t }) {
  return (
    <li key={issue._id} className="issue-list-item">
      <span className={`issue-status-dot ${issue.status}`} aria-hidden />
      <Link href={`${base}/issues/${issue.number}`} className="issue-list-title">
        {issue.title}
      </Link>
      {issue.labels?.length > 0 && (
        <span className="issue-label-chips">
          {issue.labels.map((l) => (
            <span
              key={l._id}
              className="issue-label-chip"
              style={{ borderColor: l.color, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </span>
      )}
      <span className="issue-list-meta muted">
        #{issue.number} · {issue.author?.username}
        {issue.threadId && (
          <>
            {' · '}
            <Link href={`/t/${issue.threadId}`}>{t('issue_discussion')}</Link>
          </>
        )}
      </span>
    </li>
  );
}

export default function ProjectIssuesPage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [issues, setIssues] = useState([]);
  const [labels, setLabels] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [filter, setFilter] = useState('open');
  const [labelFilter, setLabelFilter] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState('');
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const base = owner && slug ? `/p/${owner}/${slug}` : '';
  const statusParam = view === 'list' ? filter : 'all';

  useEffect(() => {
    if (!owner || !slug) return;
    setLoading(true);
    const params = { status: statusParam };
    if (view !== 'labels' && labelFilter) params.label = labelFilter;
    if (milestoneFilter) params.milestone = milestoneFilter;
    getProjectIssues(owner, slug, params)
      .then((data) => {
        setProject(data.project);
        setIssues(data.issues);
        setLabels(data.labels || []);
        setMilestones(data.milestones || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [owner, slug, statusParam, labelFilter, milestoneFilter]);

  const openIssues = useMemo(() => issues.filter((i) => i.status === 'open'), [issues]);
  const closedIssues = useMemo(() => issues.filter((i) => i.status === 'closed'), [issues]);

  const labelColumns = useMemo(() => {
    if (view !== 'labels') return [];
    const cols = labels.map((l) => ({
      id: l._id,
      name: l.name,
      color: l.color,
      issues: openIssues.filter((i) => i.labels?.some((x) => x._id === l._id)),
    }));
    const unlabeled = openIssues.filter((i) => !i.labels?.length);
    if (unlabeled.length || !labels.length) {
      cols.push({ id: 'none', name: t('issue_label_unlabeled'), color: null, issues: unlabeled });
    }
    return cols;
  }, [view, labels, openIssues, t]);

  const setViewMode = (mode) => {
    setView(mode);
    if (mode === 'labels') setLabelFilter('');
  };

  if (loading && !project) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  return (
    <Layout title={project?.name} wide>
      <ProjectNav owner={owner} slug={slug} project={project} />

      <div className="actions-row">
        {isLoggedIn() && (
          <Link href={`${base}/issues/new`} className="btn btn-primary btn-sm">
            {t('issue_new')}
          </Link>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="feed-sort-bar">
          <div className="feed-lenses" role="tablist">
            {view === 'list' &&
              ['open', 'closed', 'all'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`lens-tab${filter === s ? ' active' : ''}`}
                  onClick={() => setFilter(s)}
                >
                  {t(`issue_filter_${s}`)}
                </button>
              ))}
            <button
              type="button"
              className={`lens-tab${view === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              {t('issue_view_list')}
            </button>
            <button
              type="button"
              className={`lens-tab${view === 'board' ? ' active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              {t('issue_view_board')}
            </button>
            {labels.length > 0 && (
              <button
                type="button"
                className={`lens-tab${view === 'labels' ? ' active' : ''}`}
                onClick={() => setViewMode('labels')}
              >
                {t('issue_view_labels')}
              </button>
            )}
          </div>
        </div>

        {view === 'labels' && (
          <p className="muted issue-view-hint">{t('issue_view_labels_hint')}</p>
        )}

        {milestones.length > 0 && (
          <div className="issue-label-filter issue-label-chips" role="group" aria-label="Milestone">
            <button
              type="button"
              className={`issue-label-chip${milestoneFilter === '' ? ' active' : ''}`}
              onClick={() => setMilestoneFilter('')}
            >
              All milestones
            </button>
            <button
              type="button"
              className={`issue-label-chip${milestoneFilter === 'none' ? ' active' : ''}`}
              onClick={() => setMilestoneFilter('none')}
            >
              No milestone
            </button>
            {milestones.map((m) => (
              <button
                key={m._id}
                type="button"
                className={`issue-label-chip${milestoneFilter === m._id ? ' active' : ''}`}
                onClick={() => setMilestoneFilter(milestoneFilter === m._id ? '' : m._id)}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}

        {view !== 'labels' && labels.length > 0 && (
          <div className="issue-label-filter issue-label-chips" role="group" aria-label={t('issue_label_filter')}>
            <button
              type="button"
              className={`issue-label-chip${labelFilter === '' ? ' active' : ''}`}
              onClick={() => setLabelFilter('')}
            >
              {t('issue_label_all')}
            </button>
            <button
              type="button"
              className={`issue-label-chip${labelFilter === 'none' ? ' active' : ''}`}
              onClick={() => setLabelFilter('none')}
            >
              {t('issue_label_unlabeled')}
            </button>
            {labels.map((l) => (
              <button
                key={l._id}
                type="button"
                className={`issue-label-chip${labelFilter === l._id ? ' active' : ''}`}
                style={{ borderColor: l.color, color: l.color }}
                onClick={() => setLabelFilter(labelFilter === l._id ? '' : l._id)}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}

        {issues.length === 0 ? (
          <p className="muted">{t('issues_empty')}</p>
        ) : view === 'labels' ? (
          <div className="issue-kanban issue-kanban-labels">
            {labelColumns.map((col) => (
              <div key={col.id} className="issue-kanban-col">
                <h3 style={col.color ? { color: col.color } : undefined}>
                  {col.name} ({col.issues.length})
                </h3>
                {col.issues.map((issue) => (
                  <IssueCard key={`${col.id}-${issue._id}`} issue={issue} base={base} t={t} />
                ))}
              </div>
            ))}
          </div>
        ) : view === 'board' ? (
          <div className="issue-kanban">
            <div className="issue-kanban-col">
              <h3>{t('issue_filter_open')} ({openIssues.length})</h3>
              {openIssues.map((issue) => (
                <IssueCard key={issue._id} issue={issue} base={base} t={t} />
              ))}
            </div>
            <div className="issue-kanban-col">
              <h3>{t('issue_filter_closed')} ({closedIssues.length})</h3>
              {closedIssues.map((issue) => (
                <IssueCard key={issue._id} issue={issue} base={base} t={t} />
              ))}
            </div>
          </div>
        ) : (
          <ul className="issue-list">
            {issues.map((issue) => (
              <IssueListRow key={issue._id} issue={issue} base={base} t={t} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
