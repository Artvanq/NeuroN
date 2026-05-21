import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import { listMyOrganizations, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';
import { useI18n } from '../../lib/I18nContext';

export default function OrganizationsIndexPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [orgs, setOrgs] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/orgs');
      return;
    }
    setLoading(true);
    listMyOrganizations()
      .then(setOrgs)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.slug.toLowerCase().includes(q) ||
        String(o.name || '')
          .toLowerCase()
          .includes(q)
    );
  }, [orgs, query]);

  if (!isLoggedIn()) return null;

  return (
    <Layout title={t('orgs_title')} wide>
      <PageHeader
        eyebrow={t('orgs_eyebrow')}
        title={t('orgs_title')}
        description={t('orgs_desc')}
      />

      <div className="actions-row">
        <Link href="/orgs/new" className="btn btn-primary">
          {t('orgs_new')}
        </Link>
      </div>

      <div className="panel">
        <label className="feed-search-label">
          {t('orgs_search')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('orgs_search_placeholder')}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <Loading label={t('loading')} />
      ) : filtered.length === 0 ? (
        <p className="muted panel">{t('orgs_empty')}</p>
      ) : (
        <ul className="project-list">
          {filtered.map((o) => (
            <li key={o._id} className="project-list-item panel">
              <Link href={`/orgs/${o.slug}`} className="project-list-link">
                <span className="project-list-name">@{o.slug}</span>
                <span className="project-list-title">{o.name}</span>
                {o.description && <span className="project-list-desc muted">{o.description}</span>}
              </Link>
              <span className="project-list-meta muted">
                {o.memberCount ?? 0} members · {o.projectCount ?? 0} projects
                {o.viewerRole && <> · {o.viewerRole}</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
