import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import ProjectNav from '../../../../../components/ProjectNav';
import { getProject, getRepoFile, createPullRequest, getErrorMessage } from '../../../../../lib/api';
import { isLoggedIn } from '../../../../../lib/auth';
import { useI18n } from '../../../../../lib/I18nContext';

export default function NewPullRequestPage() {
  const router = useRouter();
  const { owner, slug, path: pathQ, action: actionQ } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    path: '',
    action: 'modify',
    content: '',
    isDraft: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) router.replace(`/login?next=/p/${owner}/${slug}/pulls/new`);
  }, [router, owner, slug]);

  useEffect(() => {
    if (!owner || !slug) return;
    getProject(owner, slug).then(setProject).catch(() => {});
  }, [owner, slug]);

  useEffect(() => {
    if (!owner || !slug || typeof pathQ !== 'string') return;
    const action = actionQ === 'add' ? 'add' : 'modify';
    setForm((f) => ({ ...f, path: pathQ, action }));
    if (action === 'modify') {
      getRepoFile(owner, slug, pathQ)
        .then((data) => setForm((f) => ({ ...f, content: data.file.content || '' })))
        .catch(() => {});
    }
  }, [owner, slug, pathQ, actionQ]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.path.trim()) {
      setError(t('pr_form_required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pr = await createPullRequest(owner, slug, {
        title: form.title.trim(),
        body: form.body.trim(),
        isDraft: form.isDraft,
        changes: [
          {
            path: form.path.trim(),
            action: form.action,
            content: form.content,
          },
        ],
      });
      router.push(`/p/${owner}/${slug}/pulls/${pr.number}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title={t('pr_new')}>
      {project && <ProjectNav owner={owner} slug={slug} project={project} />}
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          {t('pr_title')}
          <input name="title" value={form.title} onChange={handleChange} required />
        </label>
        <label>
          {t('pr_body')}
          <textarea name="body" value={form.body} onChange={handleChange} rows={4} />
        </label>
        <label>
          {t('code_file_path')}
          <input name="path" value={form.path} onChange={handleChange} required placeholder="src/index.js" />
        </label>
        <label>
          {t('pr_change_action')}
          <select name="action" value={form.action} onChange={handleChange}>
            <option value="add">{t('pr_action_add')}</option>
            <option value="modify">{t('pr_action_modify')}</option>
            <option value="delete">{t('pr_action_delete')}</option>
          </select>
        </label>
        {form.action !== 'delete' && (
          <label>
            {t('pr_file_content')}
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={12}
              className="repo-editor"
            />
          </label>
        )}
        <label className="checkbox-label">
          <input type="checkbox" name="isDraft" checked={form.isDraft} onChange={handleChange} />
          Create as draft (not mergeable until marked ready)
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('loading') : t('pr_submit')}
        </button>
      </form>
    </Layout>
  );
}
