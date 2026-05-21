import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../../../components/Layout';
import PageHeader from '../../../../../components/PageHeader';
import {
  createIssue,
  getProject,
  getCategories,
  getProjectLabels,
  getProjectIssueTemplates,
  getErrorMessage,
} from '../../../../../lib/api';
import { isLoggedIn } from '../../../../../lib/auth';
import { useI18n } from '../../../../../lib/I18nContext';

export default function NewIssuePage() {
  const router = useRouter();
  const { owner, slug } = router.query;
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [categories, setCategories] = useState([]);
  const [labels, setLabels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    openDiscussion: true,
    categorySlug: '',
    labelIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=/p/${owner}/${slug}/issues/new`);
    }
  }, [router, owner, slug]);

  useEffect(() => {
    if (!owner || !slug) return;
    getProject(owner, slug).then(setProject).catch(() => {});
    getCategories().then(setCategories).catch(() => {});
    getProjectLabels(owner, slug).then(setLabels).catch(() => []);
    getProjectIssueTemplates(owner, slug).then(setTemplates).catch(() => []);
  }, [owner, slug]);

  const applyTemplate = (templateId) => {
    const tpl = templates.find((t) => t._id === templateId);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      title: tpl.title,
      body: tpl.body,
    }));
  };

  const toggleLabel = (labelId) => {
    setForm((prev) => {
      const ids = prev.labelIds.includes(labelId)
        ? prev.labelIds.filter((id) => id !== labelId)
        : [...prev.labelIds, labelId];
      return { ...prev, labelIds: ids };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(t('issue_title_required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const issue = await createIssue(owner, slug, {
        title: form.title.trim(),
        body: form.body.trim(),
        openDiscussion: form.openDiscussion,
        categorySlug: form.categorySlug || project?.category?.slug,
        labelIds: form.labelIds.length ? form.labelIds : undefined,
      });
      router.push(`/p/${owner}/${slug}/issues/${issue.number}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title={t('issue_new')}>
      <PageHeader
        eyebrow={project ? `${owner}/${slug}` : ''}
        title={t('issue_new')}
        description={t('issue_new_desc')}
      />
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        {templates.length > 0 && (
          <label>
            Template
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Choose a template…</option>
              {templates.map((tpl) => (
                <option key={tpl._id} value={tpl._id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('issue_title')}
          <input name="title" value={form.title} onChange={handleChange} required />
        </label>
        <label>
          {t('issue_body')}
          <textarea
            name="body"
            value={form.body}
            onChange={handleChange}
            rows={8}
            placeholder={t('markdown_hint')}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="openDiscussion"
            checked={form.openDiscussion}
            onChange={handleChange}
          />
          {t('issue_open_discussion')}
        </label>
        {labels.length > 0 && (
          <div>
            <span className="label-text">{t('issue_labels_pick')}</span>
            <div className="issue-label-chips">
              {labels.map((l) => (
                <button
                  key={l._id}
                  type="button"
                  className={`issue-label-chip${form.labelIds.includes(l._id) ? ' active' : ''}`}
                  style={{ borderColor: l.color, color: l.color }}
                  onClick={() => toggleLabel(l._id)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {form.openDiscussion && (
          <label>
            {t('project_field')}
            <select name="categorySlug" value={form.categorySlug} onChange={handleChange}>
              <option value="">
                {project?.category?.name || t('project_field_none')}
              </option>
              {categories.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('loading') : t('issue_create')}
        </button>
      </form>
    </Layout>
  );
}
