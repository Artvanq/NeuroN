import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Loading from '../../components/Loading';
import { setAuth } from '../../lib/auth';
import { getMe } from '../../lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    const { token, error: err } = router.query;
    if (err) {
      setError(String(err));
      return;
    }
    if (!token || typeof token !== 'string') return;

    (async () => {
      try {
        setAuth(token, {});
        const user = await getMe();
        setAuth(token, user);
        if (!user.onboardingCompleted) {
          router.replace('/onboarding');
        } else {
          router.replace('/explore');
        }
      } catch {
        setError('Could not complete sign in');
      }
    })();
  }, [router, router.query]);

  if (error) {
    return (
      <Layout title="Sign in failed">
        <p className="error">{error}</p>
        <p>
          <a href="/login">Back to sign in</a>
        </p>
      </Layout>
    );
  }

  return (
    <Layout title="Signing in">
      <Loading label="Completing sign in…" />
    </Layout>
  );
}
