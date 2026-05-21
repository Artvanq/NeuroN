import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { createOrganization, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

export default function NewOrganizationPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login?next=/orgs/new');
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim(),
      });
      router.push(`/orgs/${org.slug}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="New organization">
      <PageHeader
        eyebrow="Teams"
        title="Create organization"
        description="Shared namespace for projects — like github.com/your-org/repo."
      />
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          Slug
          <input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="my-org"
            pattern="[a-z0-9][a-z0-9_-]*"
          />
        </label>
        <label>
          Description
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </Layout>
  );
}
