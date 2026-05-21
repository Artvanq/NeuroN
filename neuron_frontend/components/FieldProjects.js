import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../lib/I18nContext';
import { getProjects, getErrorMessage } from '../lib/api';
import Loading from './Loading';

function projectHref(p) {
  return `/p/${p.ownerUsername || p.owner?.username}/${p.slug}`;
}

export default function FieldProjects({ categorySlug }) {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const list = Array.isArray(projects) ? projects : [];

  useEffect(() => {
    if (!categorySlug) return;
    setLoading(true);
    getProjects({ categorySlug, limit: 8 })
      .then((rows) => setProjects(Array.isArray(rows) ? rows : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [categorySlug]);

  if (!categorySlug) return null;

  return (
    <section className="field-projects panel">
      <div className="field-projects-head">
        <h2>{t('field_projects_title')}</h2>
        <Link href={`/projects/new?category=${categorySlug}`} className="link-btn">
          {t('project_new')}
        </Link>
      </div>
      {loading ? (
        <Loading label={t('loading')} />
      ) : list.length === 0 ? (
        <p className="muted">{t('field_projects_empty')}</p>
      ) : (
        <ul className="project-list field-projects-list">
          {list.map((p) => (
            <li key={p._id} className="project-list-item">
              <Link href={projectHref(p)} className="project-list-link">
                <span className="project-list-name">
                  <span className="project-owner">{p.ownerUsername}/</span>
                  {p.slug}
                </span>
                <span className="project-list-title">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
