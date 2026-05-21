import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { completeOAuthSignup, getAuthConfig, getErrorMessage } from '../../lib/api';
import { setAuth } from '../../lib/auth';

export default function AuthCompletePage() {
  const router = useRouter();
  const { pending, provider, username: suggested, name } = router.query;
  const [inviteRequired, setInviteRequired] = useState(true);
  const [form, setForm] = useState({ username: '', displayName: '', inviteCode: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof suggested === 'string') {
      setForm((f) => ({ ...f, username: suggested }));
    }
    if (typeof name === 'string') {
      setForm((f) => ({ ...f, displayName: name }));
    }
  }, [suggested, name]);

  useEffect(() => {
    getAuthConfig().then((c) => setInviteRequired(c.inviteRequired)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const { user, token } = await completeOAuthSignup({
        pendingId: pending,
        username: form.username,
        displayName: form.displayName,
        inviteCode: form.inviteCode || undefined,
      });
      setAuth(token, user);
      router.push('/onboarding');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!pending) {
    return (
      <Layout title="Complete sign up">
        <p className="error">Missing sign-up session. Try signing in again.</p>
        <Link href="/login">Sign in</Link>
      </Layout>
    );
  }

  const providerLabel =
    provider === 'github' ? 'GitHub' : provider === 'reddit' ? 'Reddit' : 'LinkedIn';

  return (
    <Layout title="Finish joining">
      <div className="auth-page">
        <PageHeader
          eyebrow={`Connected via ${providerLabel}`}
          title="Choose your Neuron identity"
          description="Username is public — no email required. Invite code gates who enters the network."
        />
        {error && <p className="error">{error}</p>}
        <form className="form panel" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              pattern="[a-z0-9_]{3,32}"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Display name
            <input
              name="displayName"
              value={form.displayName}
              onChange={handleChange}
              placeholder="How others see you"
            />
          </label>
          {inviteRequired && (
            <label>
              Invite code
              <input
                name="inviteCode"
                value={form.inviteCode}
                onChange={handleChange}
                placeholder="NEURON-…"
                required
              />
            </label>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Join Neuron'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
