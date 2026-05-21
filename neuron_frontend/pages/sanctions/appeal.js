import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import { submitBanAppeal, getMyBanSanction, getErrorMessage } from '../../lib/api';
import { getToken } from '../../lib/auth';

export default function SanctionsAppealPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [sanction, setSanction] = useState(null);
  const [appeals, setAppeals] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    const qUser = router.query.username;
    if (typeof qUser === 'string' && qUser.trim()) {
      setUsername(qUser.trim().toLowerCase());
    }
  }, [router.query.username]);

  useEffect(() => {
    if (!getToken()) return;
    setLoadingStatus(true);
    getMyBanSanction()
      .then((data) => {
        setSanction(data.sanction || null);
        setAppeals(data.appeals || []);
        if (data.sanction && !data.sanction.isBanned) {
          setSuccess('Your account is not currently banned.');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  const hasPending = Boolean(sanction?.pendingAppeal);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess('');
    try {
      const payload = {
        message: message.trim(),
        ...(getToken() ? {} : { username: username.trim(), password }),
      };
      await submitBanAppeal(payload);
      setSuccess('Appeal submitted. Moderators will review it soon.');
      setMessage('');
      if (getToken()) {
        const data = await getMyBanSanction();
        setSanction(data.sanction || null);
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit appeal'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout title="Ban appeal">
      <div className="auth-page">
        <PageHeader
          eyebrow="Account sanction"
          title="Appeal a ban"
          description="Explain why your account should be reviewed. Appeals are reviewed by moderators."
        />

        {loadingStatus && <p className="muted">Loading account status…</p>}

        {sanction?.isBanned && (
          <section className="panel sanction-panel">
            <h2>Current sanction</h2>
            <p>
              <strong>Status:</strong> Banned
            </p>
            {sanction.reason ? (
              <p>
                <strong>Reason:</strong> {sanction.reason}
              </p>
            ) : null}
            {sanction.bannedAt ? (
              <p>
                <strong>Since:</strong> {new Date(sanction.bannedAt).toLocaleString()}
              </p>
            ) : null}
            {hasPending && (
              <p className="muted">
                Pending appeal submitted{' '}
                {new Date(sanction.pendingAppeal.createdAt).toLocaleString()}.
              </p>
            )}
          </section>
        )}

        {appeals.length > 0 && (
          <section className="panel">
            <h2>Your appeal history</h2>
            <ul className="invite-list">
              {appeals.map((a) => (
                <li key={a._id}>
                  <strong>{a.status}</strong> · {new Date(a.createdAt).toLocaleString()}
                  {a.moderatorNote ? ` · Note: ${a.moderatorNote}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && <p className="error">{error}</p>}
        {success && <p className="success-banner">{success}</p>}

        <form className="form panel" onSubmit={handleSubmit}>
          {!getToken() && (
            <>
              <label>
                Username
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          )}
          <label>
            Appeal message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              minLength={20}
              maxLength={2000}
              required
              disabled={hasPending}
              placeholder="Describe why the ban should be reviewed (minimum 20 characters)."
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || hasPending || message.trim().length < 20}
          >
            {submitting ? 'Submitting…' : hasPending ? 'Appeal pending' : 'Submit appeal'}
          </button>
        </form>

        <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </Layout>
  );
}
