import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { createCommunity, getMyCommunities, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';
import { useI18n } from '../../lib/I18nContext';

export default function NewCommunityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '📚',
    color: '#6366f1',
    rules: '',
  });
  const [owned, setOwned] = useState([]);
  const [limit, setLimit] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=${encodeURIComponent('/c/new')}`);
      return;
    }
    getMyCommunities()
      .then((data) => {
        setOwned(data.categories || []);
        setLimit(data.limit || 10);
      })
      .catch(() => {});
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const community = await createCommunity({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim(),
        icon: form.icon.trim(),
        color: form.color.trim(),
        rules: form.rules.trim(),
      });
      router.push(`/c/${community.slug}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Create a field">
      <PageHeader
        eyebrow="Resonance"
        title="Create a field"
        description="Start a community for threads and projects. You become its moderator."
      />

      {error && <p className="error">{error}</p>}

      <p className="muted">
        {owned.length}/{limit} communities created by you.{' '}
        <Link href="/explore#fields-all">Browse all fields</Link>
      </p>

      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} required placeholder="Neuroscience" />
        </label>
        <label>
          URL slug
          <input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="neuroscience (auto from name if empty)"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="What this field is about…"
          />
        </label>
        <label>
          Icon
          <input name="icon" value={form.icon} onChange={handleChange} maxLength={8} />
        </label>
        <label>
          Accent color
          <input name="color" type="color" value={form.color} onChange={handleChange} />
        </label>
        <label>
          Rules (optional)
          <textarea
            name="rules"
            value={form.rules}
            onChange={handleChange}
            rows={5}
            placeholder={t('markdown_hint')}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting || owned.length >= limit}>
          {submitting ? t('loading') : 'Create field'}
        </button>
      </form>
    </Layout>
  );
}
