import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import { getStatsOverview, getStatsUsers, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Metric({ label, value, hint }) {
  return (
    <div className="owner-stat-metric">
      <span className="owner-stat-label">{label}</span>
      <span className="owner-stat-value">{value}</span>
      {hint && <span className="owner-stat-hint">{hint}</span>}
    </div>
  );
}

export default function OwnerStatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0 });
  const [sort, setSort] = useState('activity');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/owner/stats');
      return;
    }

    setLoading(true);
    setForbidden(false);
    setError(null);

    Promise.all([
      getStatsOverview(),
      getStatsUsers({ sort, limit: 200, offset: 0 }),
    ])
      .then(([ov, userData]) => {
        setOverview(ov);
        setUsers(userData.users || []);
        setPagination(userData.pagination || { total: 0, limit: 200, offset: 0 });
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setForbidden(true);
        } else {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => setLoading(false));
  }, [router, sort]);

  if (loading) {
    return (
      <Layout title="Stats" wide chromeless>
        <Loading />
      </Layout>
    );
  }

  if (forbidden) {
    return (
      <Layout title="Not found" wide chromeless>
        <div className="panel" style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h1 className="page-title">404</h1>
          <p className="page-desc">Page not found.</p>
          <Link href="/explore" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Home
          </Link>
        </div>
      </Layout>
    );
  }

  if (error || !overview) {
    return (
      <Layout title="Stats" wide chromeless>
        <p className="error">{error || 'Failed to load stats'}</p>
      </Layout>
    );
  }

  const { users: u, content, messaging, categories } = overview;

  return (
    <Layout title="Site stats" wide chromeless>
      <PageHeader
        eyebrow="Owner"
        title="Site statistics"
        description={`Updated ${formatDate(overview.generatedAt)}`}
      />

      <section className="owner-stat-grid">
        <Metric label="Users" value={u.total} hint={`+${u.new24h} today · +${u.new7d} week`} />
        <Metric label="Active 7d" value={u.active7d} hint={`${u.active30d} in 30 days`} />
        <Metric label="Posts" value={content.threads} hint={`${content.replies} replies`} />
        <Metric label="DM chats" value={messaging.dmChats} />
        <Metric label="Group chats" value={messaging.groupChats} />
        <Metric label="Messages" value={messaging.messages} hint={`${messaging.totalChats} chats total`} />
        <Metric label="Categories" value={categories} />
      </section>

      <section className="panel">
        <div className="panel-head-row">
          <h2>Users & activity</h2>
          <select
            className="owner-stat-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort users"
          >
            <option value="activity">By activity</option>
            <option value="registered">By registration</option>
          </select>
        </div>

        <div className="owner-stat-table-wrap">
          <table className="owner-stat-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Posts</th>
                <th>Replies</th>
                <th>Messages</th>
                <th>Votes</th>
                <th>Chats</th>
                <th>Score</th>
                <th>Last active</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/u/${row.username}`} className="owner-stat-user">
                      @{row.username}
                    </Link>
                    {row.displayName && (
                      <span className="owner-stat-display">{row.displayName}</span>
                    )}
                  </td>
                  <td>{row.threadsCount}</td>
                  <td>{row.repliesCount}</td>
                  <td>{row.messagesCount}</td>
                  <td>{row.votesCount}</td>
                  <td>{row.chatsJoined}</td>
                  <td>{row.activityScore}</td>
                  <td>{formatDate(row.lastActivityAt)}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="owner-stat-foot">
          Showing {users.length} of {pagination.total} users
        </p>
      </section>
    </Layout>
  );
}
