import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../../../components/Layout';
import ProjectNav from '../../../../components/ProjectNav';
import ClonePanel from '../../../../components/ClonePanel';
import MarkdownBody from '../../../../components/MarkdownBody';
import Loading from '../../../../components/Loading';
import ReportButton from '../../../../components/ReportButton';
import {
  getProject,
  forkProject,
  starProject,
  unstarProject,
  watchProject,
  unwatchProject,
  getErrorMessage,
} from '../../../../lib/api';
import { useI18n } from '../../../../lib/I18nContext';
import { isLoggedIn } from '../../../../lib/auth';

export default function ProjectAboutPage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forking, setForking] = useState(false);

  useEffect(() => {
    if (!owner || !slug) return;
    getProject(owner, slug)
      .then(setProject)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [owner, slug]);

  const base = owner && slug ? `/p/${owner}/${slug}` : '';

  if (loading) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <p className="error">{error || t('project_not_found')}</p>
      </Layout>
    );
  }

  return (
    <Layout title={project.name} wide>
      <ProjectNav owner={owner} slug={slug} project={project} />
      <ClonePanel owner={owner} slug={slug} branch={project.defaultBranch || 'main'} />
      <div className="actions-row">
        {project?._id && <ReportButton targetType="project" targetId={`${owner}/${slug}`} />}
        <span className="muted">
          ★ {project.starCount ?? 0} · 👁 {project.watchCount ?? 0}
        </span>
        {isLoggedIn() && (
          <>
            <button
              type="button"
              className={`btn btn-ghost btn-sm${project.viewerStarred ? ' active' : ''}`}
              onClick={async () => {
                try {
                  const data = project.viewerStarred
                    ? await unstarProject(owner, slug)
                    : await starProject(owner, slug);
                  setProject((p) => (p ? { ...p, ...data } : p));
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              {project.viewerStarred ? 'Unstar' : 'Star'}
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm${project.viewerWatching ? ' active' : ''}`}
              onClick={async () => {
                try {
                  const data = project.viewerWatching
                    ? await unwatchProject(owner, slug)
                    : await watchProject(owner, slug);
                  setProject((p) => (p ? { ...p, ...data } : p));
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              {project.viewerWatching ? 'Unwatch' : 'Watch'}
            </button>
            <Link href={`${base}/issues/new`} className="btn btn-primary btn-sm">
              {t('issue_new')}
            </Link>
            <Link href={`${base}/pulls/new`} className="btn btn-ghost btn-sm">
              {t('pr_new')}
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={forking}
              onClick={async () => {
                setForking(true);
                setError(null);
                try {
                  const forked = await forkProject(owner, slug);
                  router.push(`/p/${forked.ownerUsername}/${forked.slug}/about`);
                } catch (err) {
                  setError(getErrorMessage(err));
                } finally {
                  setForking(false);
                }
              }}
            >
              {forking ? 'Forking…' : 'Fork'}
            </button>
          </>
        )}
      </div>
      {project.readme ? (
        <section className="panel project-readme">
          <MarkdownBody>{project.readme}</MarkdownBody>
        </section>
      ) : (
        <p className="muted panel">{t('project_no_readme')}</p>
      )}
    </Layout>
  );
}
