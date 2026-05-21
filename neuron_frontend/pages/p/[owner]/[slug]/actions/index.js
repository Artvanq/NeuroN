import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import ProjectNav from '../../../../../components/ProjectNav';
import Loading from '../../../../../components/Loading';
import { getProject, getWorkflowRuns, runWorkflow, getErrorMessage } from '../../../../../lib/api';
import { useI18n } from '../../../../../lib/I18nContext';
import { getStoredUser } from '../../../../../lib/auth';

function statusClass(status) {
  if (status === 'success') return 'ci-success';
  if (status === 'failure') return 'ci-failure';
  return 'ci-pending';
}

export default function ProjectActionsPage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const user = getStoredUser();
  const isOwner = user && project && user.username === project.ownerUsername;
  const branch = project?.defaultBranch || 'main';

  const load = useCallback(async () => {
    const [proj, data] = await Promise.all([
      getProject(owner, slug),
      getWorkflowRuns(owner, slug),
    ]);
    setProject(proj);
    setRuns(data.runs || []);
  }, [owner, slug]);

  useEffect(() => {
    if (!owner || !slug) return;
    setLoading(true);
    load()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [owner, slug, load]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      await runWorkflow(owner, slug, branch);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  return (
    <Layout title={`${owner}/${slug} — Actions`} wide>
      <ProjectNav owner={owner} slug={slug} project={project} />

      <div className="actions-page-head">
        <p className="muted">{t('actions_desc')}</p>
        {isOwner && (
          <button type="button" className="btn btn-primary btn-sm" onClick={handleRun} disabled={running}>
            {running ? t('loading') : t('actions_run')}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {runs.length === 0 ? (
        <p className="muted panel">{t('actions_empty')}</p>
      ) : (
        <ul className="ci-run-list">
          {runs.map((run) => (
            <li key={run._id} className="panel ci-run-card">
              <button
                type="button"
                className="ci-run-summary"
                onClick={() => setExpanded(expanded === run._id ? null : run._id)}
              >
                <span className={`ci-status ${statusClass(run.status)}`}>{run.status}</span>
                <span className="ci-name">{run.workflowName}</span>
                <span className="ci-meta">
                  {run.branch} · {run.trigger}
                </span>
                <span className="ci-time">
                  {run.finishedAt
                    ? new Date(run.finishedAt).toLocaleString()
                    : new Date(run.startedAt).toLocaleString()}
                </span>
              </button>
              {expanded === run._id && run.logs && (
                <pre className="ci-logs">{run.logs}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
