import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { getErrorMessage, resetPassword } from '../lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = typeof router.query.token === 'string' ? router.query.token : '';

  return (
    <Layout title="Reset password">
      <PageHeader
        eyebrow="Account recovery"
        title="Reset password"
        description="Set a new password for your Neuron account."
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
            await resetPassword({ token, newPassword });
            setMessage('Password changed. You can sign in now.');
          } catch (err) {
            setError(getErrorMessage(err));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <section className="panel">
          <label className="form">
            New password
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!token || submitting}>
            {submitting ? 'Updating…' : 'Set new password'}
          </button>
        </section>
      </form>
    </Layout>
  );
}
