import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { getCategories, getThread, crosspostThread, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

export default function CrosspostPage() {
  const router = useRouter();
  const { id } = router.query;
  const [source, setSource] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categorySlug, setCategorySlug] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=/crosspost/${id || ''}`);
    }
  }, [router, id]);

  useEffect(() => {
    if (!id) return;
    getThread(id)
      .then((t) => {
        setSource(t);
        setTitle(t.title || '');
      })
      .catch((err) => setError(getErrorMessage(err)));
    getCategories().then(setCategories).catch(() => {});
  }, [id]);

  const availableCategories = categories.filter(
    (c) => c.slug && c.slug !== source?.category?.slug
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categorySlug) {
      setError('Select a target field');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const thread = await crosspostThread(id, {
        categorySlug,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      router.push(`/t/${thread._id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Crosspost failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!source && !error) {
    return (
      <Layout>
        <p className="muted">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Crosspost">
      <PageHeader
        eyebrow="Resonance"
        title="Crosspost to another field"
        description="Share this question in a different community. Responses stay on the original thread."
      />
      {source && (
        <p className="muted">
          From{' '}
          <Link href={`/c/${source.category?.slug}`}>{source.category?.name}</Link>
          {' · '}
          <Link href={`/t/${source._id}`}>{source.title}</Link>
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          Target field
          <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} required>
            <option value="">Select field…</option>
            {availableCategories.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Optional note
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Add context for this field…" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Posting…' : 'Crosspost'}
        </button>
        <p className="muted">
          <Link href={source ? `/t/${source._id}` : '/'}>Cancel</Link>
        </p>
      </form>
    </Layout>
  );
}
