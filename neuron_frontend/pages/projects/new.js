import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { getCategories, createProject, getErrorMessage } from '../../lib/api';
import { isLoggedIn, getStoredUser } from '../../lib/auth';
import { useI18n } from '../../lib/I18nContext';

export default function NewProjectPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    readme: '',
    categorySlug: '',
    organizationSlug: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login?next=/projects/new');
  }, [router]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const cat = router.query.category;
    if (typeof cat === 'string' && cat) {
      setForm((prev) => ({ ...prev, categorySlug: cat }));
    }
    const org = router.query.org;
    if (typeof org === 'string' && org) {
      setForm((prev) => ({ ...prev, organizationSlug: org }));
    }
  }, [router.query.category, router.query.org]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t('project_name_required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim(),
        readme: form.readme.trim(),
        categorySlug: form.categorySlug || undefined,
        organizationSlug: form.organizationSlug.trim() || undefined,
      });
      const owner = project.ownerUsername || getStoredUser()?.username;
      router.push(`/p/${owner}/${project.slug}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title={t('project_new')}>
      <PageHeader
        eyebrow={t('projects_eyebrow')}
        title={t('project_new')}
        description={t('project_new_desc')}
      />
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          {t('project_name')}
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          {t('project_slug')}
          <input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="my-project"
            pattern="[a-z0-9-]+"
          />
        </label>
        <label>
          Organization (optional)
          <input
            name="organizationSlug"
            value={form.organizationSlug}
            onChange={handleChange}
            placeholder="my-org"
            pattern="[a-z0-9][a-z0-9_-]*"
          />
        </label>
        <label>
          {t('project_description')}
          <input name="description" value={form.description} onChange={handleChange} />
        </label>
        <label>
          {t('project_field')}
          <select name="categorySlug" value={form.categorySlug} onChange={handleChange}>
            <option value="">{t('project_field_none')}</option>
            {categories.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('project_readme')}
          <textarea
            name="readme"
            value={form.readme}
            onChange={handleChange}
            rows={10}
            placeholder={t('markdown_hint')}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('loading') : t('project_create')}
        </button>
      </form>
    </Layout>
  );
}
