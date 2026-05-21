import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../../components/Layout';
import ProjectNav from '../../../../components/ProjectNav';
import Loading from '../../../../components/Loading';
import {
  getProject,
  getProjectCollaborators,
  addProjectCollaborator,
  updateProjectCollaborator,
  removeProjectCollaborator,
  getBranchProtection,
  updateBranchProtection,
  deleteProject,
  getProjectLabels,
  createProjectLabel,
  deleteProjectLabel,
  getProjectMilestones,
  createProjectMilestone,
  deleteProjectMilestone,
  updateProject,
  getProjectIssueTemplates,
  createProjectIssueTemplate,
  deleteProjectIssueTemplate,
  getErrorMessage,
} from '../../../../lib/api';
import { useI18n } from '../../../../lib/I18nContext';
import { isLoggedIn } from '../../../../lib/auth';

const ROLES = ['READ', 'WRITE', 'MAINTAINER'];

export default function ProjectSettingsPage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [protection, setProtection] = useState(null);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('WRITE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState([]);
  const [labelName, setLabelName] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  const canAdmin = project?.viewerPermissions?.admin;

  const load = async () => {
    if (!owner || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, collabData, prot, labelRows, milestoneRows, templateRows] = await Promise.all([
        getProject(owner, slug),
        getProjectCollaborators(owner, slug).catch(() => ({ collaborators: [] })),
        getBranchProtection(owner, slug, { branch: 'main' }).catch(() => null),
        getProjectLabels(owner, slug).catch(() => []),
        getProjectMilestones(owner, slug).catch(() => []),
        getProjectIssueTemplates(owner, slug).catch(() => []),
      ]);
      setProject(proj);
      setCollaborators(collabData.collaborators || []);
      setProtection(prot?.protection || null);
      setLabels(labelRows);
      setMilestones(milestoneRows);
      setVisibility(proj.visibility || 'PUBLIC');
      setTemplates(templateRows);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=/p/${owner}/${slug}/settings`);
      return;
    }
    load();
  }, [owner, slug, router]);

  const saveProtection = async (patch) => {
    setBusy(true);
    try {
      const data = await updateBranchProtection(owner, slug, { branch: 'main', ...patch });
      setProtection(data.protection);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !project) {
    return (
      <Layout wide>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  if (!canAdmin) {
    return (
      <Layout wide>
        {project && <ProjectNav owner={owner} slug={slug} project={project} />}
        <p className="error panel">{t('project_settings_forbidden')}</p>
      </Layout>
    );
  }

  return (
    <Layout title={t('project_tab_settings')} wide>
      {project && <ProjectNav owner={owner} slug={slug} project={project} />}

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>{t('project_collaborators_title')}</h2>
        <p className="muted">{t('project_collaborators_desc')}</p>
        <form
          className="emergence-actions"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!username.trim()) return;
            setBusy(true);
            try {
              await addProjectCollaborator(owner, slug, { username: username.trim(), role });
              setUsername('');
              const data = await getProjectCollaborators(owner, slug);
              setCollaborators(data.collaborators || []);
            } catch (err) {
              setError(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('project_collaborator_username')}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
            {t('project_collaborator_add')}
          </button>
        </form>
        {collaborators.length === 0 ? (
          <p className="muted">{t('project_collaborators_empty')}</p>
        ) : (
          <ul className="invite-list">
            {collaborators.map((c) => (
              <li key={c._id}>
                @{c.user?.username} · {c.role}
                <select
                  value={c.role}
                  className="btn btn-ghost btn-sm"
                  onChange={async (e) => {
                    try {
                      await updateProjectCollaborator(owner, slug, c.user._id, {
                        role: e.target.value,
                      });
                      await load();
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      await removeProjectCollaborator(owner, slug, c.user._id);
                      setCollaborators((prev) => prev.filter((x) => x._id !== c._id));
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  {t('project_collaborator_remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Visibility</h2>
        <p className="muted">Private projects are visible only to owner, org members, and collaborators.</p>
        <label>
          Access
          <select
            value={visibility}
            onChange={async (e) => {
              const next = e.target.value;
              setVisibility(next);
              setBusy(true);
              try {
                await updateProject(owner, slug, { visibility: next });
                setProject((p) => (p ? { ...p, visibility: next } : p));
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>Milestones</h2>
        <form
          className="emergence-actions"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!milestoneTitle.trim()) return;
            setBusy(true);
            try {
              await createProjectMilestone(owner, slug, { title: milestoneTitle.trim() });
              setMilestoneTitle('');
              setMilestones(await getProjectMilestones(owner, slug));
            } catch (err) {
              setError(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            placeholder="v1.0, beta…"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
            Add milestone
          </button>
        </form>
        {milestones.length === 0 ? (
          <p className="muted">No milestones yet.</p>
        ) : (
          <ul className="invite-list">
            {milestones.map((m) => (
              <li key={m._id}>
                <strong>{m.title}</strong>
                <span className="muted">
                  {' '}
                  · {m.state} · {m.openIssueCount ?? 0} open
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      await deleteProjectMilestone(owner, slug, m._id);
                      setMilestones((prev) => prev.filter((x) => x._id !== m._id));
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Issue templates</h2>
        <p className="muted">Prefill title and body when opening New issue.</p>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!templateName.trim() || !templateTitle.trim()) return;
            setBusy(true);
            try {
              await createProjectIssueTemplate(owner, slug, {
                name: templateName.trim(),
                title: templateTitle.trim(),
                body: templateBody.trim(),
              });
              setTemplateName('');
              setTemplateTitle('');
              setTemplateBody('');
              setTemplates(await getProjectIssueTemplates(owner, slug));
            } catch (err) {
              setError(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="bug-report" />
          </label>
          <label>
            Title
            <input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Bug: …" />
          </label>
          <label>
            Body
            <textarea
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              rows={4}
              placeholder={t('markdown_hint')}
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
            Add template
          </button>
        </form>
        {templates.length === 0 ? (
          <p className="muted">No templates yet.</p>
        ) : (
          <ul className="invite-list">
            {templates.map((tpl) => (
              <li key={tpl._id}>
                <strong>{tpl.name}</strong>
                <span className="muted"> — {tpl.title}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      await deleteProjectIssueTemplate(owner, slug, tpl._id);
                      setTemplates((prev) => prev.filter((x) => x._id !== tpl._id));
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Issue labels</h2>
        <p className="muted">Colored labels for issues; filter and board view on the Issues tab.</p>
        <form
          className="emergence-actions"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!labelName.trim()) return;
            setBusy(true);
            try {
              await createProjectLabel(owner, slug, { name: labelName.trim() });
              setLabelName('');
              setLabels(await getProjectLabels(owner, slug));
            } catch (err) {
              setError(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            placeholder="bug, feature, docs…"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
            Add label
          </button>
        </form>
        {labels.length === 0 ? (
          <p className="muted">No labels yet.</p>
        ) : (
          <ul className="invite-list">
            {labels.map((l) => (
              <li key={l._id}>
                <span className="issue-label-chip" style={{ borderColor: l.color, color: l.color }}>
                  {l.name}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      await deleteProjectLabel(owner, slug, l._id);
                      setLabels((prev) => prev.filter((x) => x._id !== l._id));
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>{t('project_protection_title')}</h2>
        <p className="muted">{t('project_protection_desc')}</p>
        {protection && (
          <div className="notification-prefs-list">
            <label className="notification-pref-row">
              <input
                type="checkbox"
                checked={protection.requireCiSuccess}
                onChange={(e) => saveProtection({ requireCiSuccess: e.target.checked })}
              />
              <span>{t('project_protection_ci')}</span>
            </label>
            <label className="notification-pref-row">
              <input
                type="checkbox"
                checked={protection.requireReview}
                onChange={(e) => saveProtection({ requireReview: e.target.checked })}
              />
              <span>{t('project_protection_review')}</span>
            </label>
            <label className="notification-pref-row">
              <span>{t('project_protection_approvals')}</span>
              <input
                type="number"
                min={1}
                max={10}
                value={protection.requiredApprovalCount}
                onChange={(e) =>
                  saveProtection({ requiredApprovalCount: Number(e.target.value) || 1 })
                }
              />
            </label>
          </div>
        )}
      </section>

      {project?.viewerPermissions?.owner && (
        <section className="panel danger-zone">
          <h2>{t('project_delete_title')}</h2>
          <p className="muted">{t('project_delete_desc')}</p>
          <form
            className="emergence-actions"
            onSubmit={async (e) => {
              e.preventDefault();
              const confirmSlug = e.target.confirmSlug.value.trim();
              if (confirmSlug !== slug) {
                setError(t('project_delete_confirm'));
                return;
              }
              if (!window.confirm(t('project_delete_button') + '?')) return;
              setBusy(true);
              try {
                await deleteProject(owner, slug);
                router.push('/projects');
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              name="confirmSlug"
              placeholder={t('project_delete_confirm')}
              disabled={busy}
            />
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
              {t('project_delete_button')}
            </button>
          </form>
        </section>
      )}
    </Layout>
  );
}
