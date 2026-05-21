import Link from 'next/link';
import { useRouter } from 'next/router';
import { useI18n } from '../lib/I18nContext';

export default function ProjectNav({ owner, slug, project }) {
  const router = useRouter();
  const { t } = useI18n();
  const base = `/p/${owner}/${slug}`;

  const tabs = [
    { href: `${base}/code`, label: t('project_tab_code'), match: (p) => p.includes('/code') },
    { href: `${base}/issues`, label: t('project_tab_issues'), match: (p) => p.includes('/issues') },
    { href: `${base}/pulls`, label: t('project_tab_pulls'), match: (p) => p.includes('/pulls') },
    { href: `${base}/actions`, label: t('project_tab_actions'), match: (p) => p.includes('/actions') },
    { href: `${base}/about`, label: t('project_tab_about'), match: (p) => p.endsWith('/about') },
    {
      href: `${base}/settings`,
      label: t('project_tab_settings'),
      match: (p) => p.includes('/settings'),
      adminOnly: true,
    },
  ];

  return (
    <header className="project-header panel">
      <p className="eyebrow">{t('projects_eyebrow')}</p>
      <h1 className="project-repo-title">
        <Link href={`/u/${owner}`}>{owner}</Link>
        <span>/</span>
        <span>{slug}</span>
      </h1>
      {project?.description && <p className="project-desc">{project.description}</p>}
      <nav className="project-tabs" aria-label={t('project_tabs_label')}>
        {tabs
          .filter((tab) => !tab.adminOnly || project?.viewerPermissions?.admin)
          .map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`project-tab${tab.match(router.pathname) ? ' active' : ''}`}
          >
            {tab.label}
            {tab.href.includes('/issues') && project?.openIssueCount != null && (
              <span className="project-tab-count">{project.openIssueCount}</span>
            )}
            {tab.href.includes('/pulls') && project?.openPullCount != null && (
              <span className="project-tab-count">{project.openPullCount}</span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  );
}
