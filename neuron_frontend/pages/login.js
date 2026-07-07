import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import OAuthButtons from '../components/OAuthButtons';
import {
  login,
  getMe,
  getErrorMessage,
  getBanErrorDetails,
  requestEmailVerificationPublic,
} from '../lib/api';
import { setAuth } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const next = router.query.next || '/explore';
  const [form, setForm] = useState({ username: '', password: '', totpCode: '' });
  const [needsTotp, setNeedsTotp] = useState(false);
  const [needsEmailVerify, setNeedsEmailVerify] = useState(false);
  const [verifyResent, setVerifyResent] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [banDetails, setBanDetails] = useState(null);

  useEffect(() => {
    const err = router.query.error;
    if (!err) return;
    const code = String(err);
    if (code === 'account_banned') {
      setError('Account is banned. Contact support if you believe this is a mistake.');
      return;
    }
    setError(code);
  }, [router.query.error]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBanDetails(null);
    setNeedsEmailVerify(false);
    setVerifyResent(false);
    try {
      const { user, token } = await login(form);
      setNeedsTotp(false);
      setAuth(token, user);
      const full = await getMe().catch(() => user);
      setAuth(token, full);
      if (!full.onboardingCompleted) {
        router.push('/onboarding');
      } else {
        router.push(typeof next === 'string' ? next : '/explore');
      }
    } catch (err) {
      const ban = getBanErrorDetails(err);
      if (ban) {
        setBanDetails(ban);
        setError(ban.message);
      } else {
        const code = err.response?.data?.code;
        if (code === 'totp_required') {
          setNeedsTotp(true);
          setError('Enter your authenticator code to continue.');
        } else if (code === 'email_verification_required') {
          setNeedsEmailVerify(true);
          setError(
            'Confirm your email before signing in. Open the link we sent, or request a new one below.'
          );
        } else {
          setError(getErrorMessage(err, 'Login failed'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Sign in">
      <div className="auth-page">
        <PageHeader
          eyebrow="Return"
          title="Sign in"
          description="Pick up where your mind left off — questions, collisions, emergence."
        />
        {error && <p className="error">{error}</p>}
        {banDetails && (
          <section className="panel sanction-panel">
            <p className="muted">
              {banDetails.bannedAt
                ? `Banned since ${new Date(banDetails.bannedAt).toLocaleString()}.`
                : 'Your account is currently banned.'}
            </p>
            {banDetails.bannedReason ? (
              <p>
                <strong>Reason:</strong> {banDetails.bannedReason}
              </p>
            ) : null}
            <Link
              href={`/sanctions/appeal?username=${encodeURIComponent(form.username || '')}`}
              className="btn btn-ghost btn-sm"
            >
              Submit an appeal
            </Link>
          </section>
        )}

        <form className="form panel" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </label>
          {needsTotp && (
            <label>
              Authenticator code
              <input
                name="totpCode"
                value={form.totpCode}
                onChange={handleChange}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </label>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in with password'}
          </button>
          {needsEmailVerify && (
            <div className="panel" style={{ marginTop: '1rem' }}>
              <p className="muted">
                Use the verification link from your inbox. If it expired, we can send another to
                the email on this account.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={verifyResending || !form.username.trim()}
                onClick={async () => {
                  setVerifyResending(true);
                  setVerifyResent(false);
                  setError(null);
                  try {
                    await requestEmailVerificationPublic(form.username.trim());
                    setVerifyResent(true);
                  } catch (err) {
                    setError(getErrorMessage(err));
                  } finally {
                    setVerifyResending(false);
                  }
                }}
              >
                {verifyResending ? 'Sending…' : 'Resend verification email'}
              </button>
              {verifyResent && (
                <p className="success-banner">
                  If this account needs verification, a new email was sent.
                </p>
              )}
            </div>
          )}
          <p className="muted">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        </form>

        <OAuthButtons />

        <p className="muted" style={{ textAlign: 'center' }}>
          New here? <Link href="/register">Join with invite</Link>
        </p>
      </div>
    </Layout>
  );
}
