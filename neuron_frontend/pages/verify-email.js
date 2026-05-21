import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { confirmEmailVerification, getErrorMessage } from '../lib/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = typeof router.query.token === 'string' ? router.query.token : '';
    if (!token || status !== 'idle') return;
    setStatus('loading');
    confirmEmailVerification(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(getErrorMessage(err));
      });
  }, [router.query.token, status]);

  return (
    <Layout title="Verify email">
      <PageHeader
        eyebrow="Account security"
        title="Verify email"
        description="Confirming your email for password recovery and notifications."
      />
      {status === 'loading' && <p className="muted">Verifying…</p>}
      {status === 'success' && <p className="success-banner">Email verified successfully.</p>}
      {status === 'error' && <p className="error">{error || 'Verification failed'}</p>}
    </Layout>
  );
}
