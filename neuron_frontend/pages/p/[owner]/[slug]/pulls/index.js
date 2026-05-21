import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import ProjectNav from '../../../../../components/ProjectNav';
import Loading from '../../../../../components/Loading';
import { getPullRequests, getErrorMessage } from '../../../../../lib/api';
import { useI18n } from '../../../../../lib/I18nContext';
import { isLoggedIn } from '../../../../../lib/auth';

export default function ProjectPullsPage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [pulls, setPulls] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const base = owner && slug ? `/p/${owner}/${slug}` : '';

  useEffect(() => {
    if (!owner || !slug) return;
    setLoading(true);
    getPullRequests(owner, slug, { status: filter === 'all' ? 'all' : filter })
      .then((data) => {
        setProject(data.project);
        setPulls(data.pullRequests);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [owner, slug, filter]);

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
          <Link href={`${base}/pulls/new`} className="btn btn-primary btn-sm">
            {t('pr_new')}
          </Link>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="feed-lenses" role="tablist">
          {['open', 'merged', 'closed', 'all'].map((s) => (
            <button
              key={s}
              type="button"
              className={`lens-tab${filter === s ? ' active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {t(`pr_filter_${s}`)}
            </button>
          ))}
        </div>

        {pulls.length === 0 ? (
          <p className="muted">{t('pr_empty')}</p>
        ) : (
          <ul className="pr-list">
            {pulls.map((pr) => (
              <li key={pr._id} className="pr-list-item">
                <Link href={`${base}/pulls/${pr.number}`} className="pr-list-title">
                  {pr.title}
                </Link>
                <span className={`pr-status ${pr.status}`}>{pr.status}</span>
                {pr.isDraft && <span className="issue-status-badge closed">draft</span>}
                <span className="muted pr-list-meta">
                  #{pr.number} · {pr.author?.username}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
