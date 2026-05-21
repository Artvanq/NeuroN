import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import PageHeader from '../../../components/PageHeader';
import { createGroup, searchUsers, getErrorMessage } from '../../../lib/api';
import { generateGroupKeyBase64, cacheGroupKey } from '../../../lib/chatCrypto';
import { isLoggedIn } from '../../../lib/auth';

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login?next=/messages/groups/new');
  }, [router]);

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(searchQ.trim()).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const toggleUser = (u) => {
    setSelected((prev) =>
      prev.some((x) => x._id === u._id)
        ? prev.filter((x) => x._id !== u._id)
        : [...prev, u]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const groupKey = generateGroupKeyBase64();
      const group = await createGroup({
        name: name.trim(),
        memberUsernames: selected.map((u) => u.username),
        groupKey,
      });
      cacheGroupKey(group._id, groupKey);
      router.push(`/messages/${group._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="New group">
      <PageHeader
        eyebrow="Encrypted group"
        title="Create a group"
        description="Telegram-style group chat. Messages are encrypted on your device — the server only stores ciphertext."
      />

      {error && <p className="error">{error}</p>}

      <form className="panel form" onSubmit={handleSubmit}>
        <label>
          Group name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Physics minds, Night thinkers…"
            required
          />
        </label>

        <label>
          Add members (search by username)
          <input
            type="search"
            className="search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="username…"
          />
        </label>

        {results.length > 0 && (
          <ul className="user-search-list">
            {results.map((u) => {
              const on = selected.some((x) => x._id === u._id);
              return (
                <li key={u._id}>
                  <button type="button" className={`field-chip${on ? ' active' : ''}`} onClick={() => toggleUser(u)}>
                    {u.displayName || u.username} @{u.username}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected.length > 0 && (
          <p className="muted">
            Selected: {selected.map((u) => u.username).join(', ')}
          </p>
        )}

        <p className="encrypted-note">🔒 End-to-end style encryption (AES-GCM). Key is shared only with group members over HTTPS.</p>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create encrypted group'}
        </button>
        <p className="muted">
          <Link href="/messages">Cancel</Link>
        </p>
      </form>
    </Layout>
  );
}
