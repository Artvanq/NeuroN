import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import { getProjects, getErrorMessage } from '../../lib/api';
import { useI18n } from '../../lib/I18nContext';
import { isLoggedIn } from '../../lib/auth';

function projectHref(p) {
  return `/p/${p.ownerUsername || p.owner?.username}/${p.slug}`;
}

export default function ProjectsPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjects()
      .then((rows) => setProjects(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title={t('projects_title')} wide>
      <PageHeader
        eyebrow={t('projects_eyebrow')}
        title={t('projects_title')}
        description={t('projects_desc')}
      />

      <div className="actions-row">
        {isLoggedIn() && (
          <>
            <Link href="/projects/new" className="btn btn-primary">
              {t('project_new')}
            </Link>
            <Link href="/orgs" className="btn btn-secondary">
              {t('orgs_title')}
            </Link>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <Loading label={t('loading')} />
      ) : projects.length === 0 ? (
        <p className="muted panel">{t('projects_empty')}</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p._id} className="project-list-item panel">
              <Link href={projectHref(p)} className="project-list-link">
                <span className="project-list-name">
                  <span className="project-owner">{p.ownerUsername}/</span>
                  {p.slug}
                </span>
                <span className="project-list-title">{p.name}</span>
                {p.description && <span className="project-list-desc">{p.description}</span>}
              </Link>
              <span className="project-list-meta muted">
                {p.openIssueCount ?? 0} {t('issues_open')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
