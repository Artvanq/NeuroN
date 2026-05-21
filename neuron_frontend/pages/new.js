import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { getCategories, createThread, getErrorMessage } from '../lib/api';
import MediaCompose from '../components/MediaCompose';
import InquiryPicker from '../components/InquiryPicker';
import { isLoggedIn } from '../lib/auth';
import { useI18n } from '../lib/I18nContext';

export default function NewThreadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { category: categoryQuery } = router.query;
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', categorySlug: '' });
  const [attachments, setAttachments] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [addPoll, setAddPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollEndsAt, setPollEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/new');
    }
  }, [router]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (categoryQuery && typeof categoryQuery === 'string') {
      setForm((f) => ({ ...f, categorySlug: categoryQuery }));
    }
  }, [categoryQuery]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.categorySlug) {
      setError('Title and category are required');
      return;
    }

    if (addPoll) {
      const labels = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (labels.length < 2) {
        setError('Poll needs at least two options');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        categorySlug: form.categorySlug,
        attachments,
        inquiries,
      };
      if (addPoll) {
        payload.poll = {
          options: pollOptions.map((o) => o.trim()).filter(Boolean),
          endsAt: pollEndsAt || undefined,
        };
      }
      const thread = await createThread(payload);
      router.push(`/t/${thread._id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create thread'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Open question">
      <PageHeader
        eyebrow="Create"
        title="Open a question"
        description="A good question attracts the right minds. There is no single correct answer."
      />
      {error && <p className="error">{error}</p>}
      <form className="form panel" onSubmit={handleSubmit}>
        <label>
          {t('fields_pick_one')}
          <select
            name="categorySlug"
            value={form.categorySlug}
            onChange={handleChange}
            required
          >
            <option value="">{t('fields_select')}</option>
            {categories.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        <InquiryPicker value={inquiries} onChange={setInquiries} disabled={submitting} />
        <label>
          Question
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="What burns inside you?"
            required
          />
        </label>
        <label>
          Context
          <textarea
            name="body"
            value={form.body}
            onChange={handleChange}
            rows={8}
            placeholder={t('markdown_hint')}
          />
        </label>
        <MediaCompose
          kind="POST"
          attachments={attachments}
          onChange={setAttachments}
          disabled={submitting}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={addPoll}
            onChange={(e) => setAddPoll(e.target.checked)}
          />
          Add a poll (2–6 options)
        </label>
        {addPoll && (
          <div className="poll-compose panel-inset">
            {pollOptions.map((opt, idx) => (
              <label key={idx}>
                Option {idx + 1}
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Choice ${idx + 1}`}
                />
              </label>
            ))}
            {pollOptions.length < 6 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPollOptions((opts) => [...opts, ''])}
              >
                Add option
              </button>
            )}
            <label>
              Closes at (optional)
              <input
                type="datetime-local"
                value={pollEndsAt}
                onChange={(e) => setPollEndsAt(e.target.value)}
              />
            </label>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Opening…' : 'Open question'}
        </button>
        <p className="muted">
          <Link href="/explore">Cancel</Link>
        </p>
      </form>
    </Layout>
  );
}
