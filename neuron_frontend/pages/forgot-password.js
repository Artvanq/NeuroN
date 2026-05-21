import { useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { getErrorMessage, requestPasswordReset } from '../lib/api';

export default function ForgotPasswordPage() {
  const [identity, setIdentity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  return (
    <Layout title="Forgot password">
      <PageHeader
        eyebrow="Account recovery"
        title="Forgot password"
        description="Enter your username or verified email, and we will send a reset link."
      />
      {message && <p className="success-banner">{message}</p>}
      {error && <p className="error">{error}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setError('');
          setMessage('');
          try {
            await requestPasswordReset(identity);
            setMessage('If the account exists, reset instructions were sent.');
          } catch (err) {
            setError(getErrorMessage(err));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <section className="panel">
          <label className="form">
            Username or email
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="username or you@example.com"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </section>
      </form>
    </Layout>
  );
}
