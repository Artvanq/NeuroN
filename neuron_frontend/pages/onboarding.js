import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import ContentLocaleSwitcher from '../components/ContentLocaleSwitcher';
import { getCategories, updateMe, getErrorMessage } from '../lib/api';
import { isLoggedIn, getStoredUser, updateStoredUser } from '../lib/auth';
import { useContentLocale } from '../lib/ContentLocaleContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { contentLocale } = useContentLocale();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mindStatement, setMindStatement] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/register');
      return;
    }
    const user = getStoredUser();
    if (user?.onboardingCompleted) {
      router.replace('/explore');
      return;
    }
    getCategories()
      .then(setCategories)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleCategory = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 8)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Choose at least one field that pulls you');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await updateMe({
        mindStatement: mindStatement.trim(),
        interestedCategoryIds: selected,
        onboardingCompleted: true,
        contentLocale,
      });
      updateStoredUser(user);
      router.push('/explore');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Welcome">
        <Loading label="Preparing your channel…" />
      </Layout>
    );
  }

  return (
    <Layout title="Welcome" wide>
      <PageHeader
        eyebrow="Step inside"
        title="Tune your resonance"
        description="No résumé. No followers. Tell us how you think — and which fields pull you."
      />

      {error && <p className="error">{error}</p>}

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <section className="panel">
          <h2>Your living mind</h2>
          <label className="form">
            <span className="label-text">
              What questions burn inside you right now?
            </span>
            <textarea
              value={mindStatement}
              onChange={(e) => setMindStatement(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="I think about consciousness, emergence, and why intellects remain isolated…"
            />
          </label>
        </section>

        <section className="panel">
          <h2>Content language</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Posts and comments from any language will be translated into this language (you can change it anytime in Settings).
          </p>
          <ContentLocaleSwitcher showLabel />
        </section>

        <section className="panel">
          <h2>Fields that call you</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick up to 8 — we surface questions in these channels first.
          </p>
          <ul className="onboarding-fields">
            {categories.map((c) => {
              const active = selected.includes(c._id);
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    className={`field-chip${active ? ' active' : ''}`}
                    style={active ? { borderColor: c.color, color: c.color } : {}}
                    onClick={() => toggleCategory(c._id)}
                  >
                    <span>{c.icon}</span> {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
          {submitting ? 'Entering…' : 'Enter Neuron'}
        </button>
      </form>
    </Layout>
  );
}
