import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import OAuthButtons from '../components/OAuthButtons';
import { register, getMe, getErrorMessage, getAuthConfig } from '../lib/api';
import { setAuth } from '../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [inviteRequired, setInviteRequired] = useState(true);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(false);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    inviteCode: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((c) => {
        setInviteRequired(c.inviteRequired);
        setCaptchaEnabled(Boolean(c.captchaEnabled));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!captchaEnabled) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      if (globalThis?.turnstile) {
        setCaptchaReady(true);
        return;
      }
      setTimeout(tick, 300);
    };
    tick();
    return () => {
      active = false;
    };
  }, [captchaEnabled]);

  useEffect(() => {
    if (!captchaEnabled || !captchaReady) return;
    const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;
    const turnstile = globalThis?.turnstile;
    if (!siteKey || !turnstile) return;

    const container = document.getElementById('register-captcha');
    if (!container || container.dataset.rendered === '1') return;
    container.dataset.rendered = '1';

    turnstile.render('#register-captcha', {
      sitekey: siteKey,
      callback: (token) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
      'error-callback': () => setCaptchaToken(''),
      theme: 'dark',
    });
  }, [captchaEnabled, captchaReady]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user, token } = await register({
        ...form,
        ...(captchaEnabled ? { captchaToken } : {}),
      });
      setAuth(token, user);
      const full = await getMe().catch(() => user);
      setAuth(token, full);
      router.push('/onboarding');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Join">
      <div className="auth-page">
        <PageHeader
          eyebrow="Cognitive synesthesia"
          title="Join Neuron"
          description="Not another feed. A place for minds that think the same way — but differently. Invite required for the first wave."
        />
        {error && <p className="error">{error}</p>}

        <form className="form panel" onSubmit={handleSubmit}>
          {inviteRequired && (
            <label>
              Invite code
              <input
                name="inviteCode"
                value={form.inviteCode}
                onChange={handleChange}
                placeholder="NEURON-FOUNDERS"
                required
              />
              <span className="field-hint">Ask a member or use a founder code for the first wave.</span>
            </label>
          )}
          <label>
            Username
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              pattern="[a-z0-9_]{3,32}"
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
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {captchaEnabled && (
            <div>
              <div id="register-captcha" />
              <span className="field-hint">Complete captcha to create account.</span>
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (captchaEnabled && !captchaToken)}
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <OAuthButtons />

        <p className="muted" style={{ textAlign: 'center' }}>
          Already here? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </Layout>
  );
}
