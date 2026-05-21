import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader, { PageHeaderAction } from '../../components/PageHeader';
import Loading from '../../components/Loading';
import { getConversations, searchUsers, getErrorMessage } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';
import { isEncryptedPayload, decryptMessage } from '../../lib/chatCrypto';
import { loadGroupKey } from '../../lib/chatKeys';

async function previewText(conversation, lastMessage) {
  if (!lastMessage?.body) return null;
  if (!isEncryptedPayload(lastMessage.body)) return lastMessage.body;
  try {
    const key = await loadGroupKey(conversation._id);
    return await decryptMessage(lastMessage.body, key);
  } catch {
    return '🔒 Encrypted message';
  }
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/messages');
      return;
    }
    getConversations()
      .then(async (list) => {
        setConversations(list);
        const map = {};
        await Promise.all(
          list.map(async (c) => {
            if (c.lastMessage) {
              map[c._id] = await previewText(c, c.lastMessage);
            }
          })
        );
        setPreviews(map);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const users = await searchUsers(searchQ.trim());
        setSearchResults(users);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  return (
    <Layout title="Dialogue">
      <PageHeader
        eyebrow="Encrypted dialogue"
        title="Chats"
        description="Direct messages and groups — encrypted like Telegram secret chats (client-side AES-GCM)."
        action={
          <>
            <PageHeaderAction href="/messages/groups/new" primary>
              New group
            </PageHeaderAction>
          </>
        }
      />

      <section className="panel">
        <h2>Start a direct chat</h2>
        <input
          type="search"
          placeholder="Search users by username…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <ul className="user-search-list">
            {searchResults.map((u) => (
              <li key={u._id}>
                <Link href={`/u/${u.username}`}>
                  {u.displayName || u.username} (@{u.username})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>All chats</h2>
        {loading ? (
          <Loading />
        ) : conversations.length === 0 ? (
          <p className="muted">No chats yet. Message someone or create a group.</p>
        ) : (
          <ul className="conversation-list">
            {conversations.map((c) => {
              const title =
                c.type === 'GROUP'
                  ? `👥 ${c.name || 'Group'}`
                  : c.otherParticipant?.displayName ||
                    c.otherParticipant?.username ||
                    'Chat';
              const preview = previews[c._id];
              return (
                <li key={c._id}>
                  <Link href={`/messages/${c._id}`} className="conversation-item">
                    <strong>
                      {c.encrypted && <span className="lock-icon">🔒 </span>}
                      {title}
                    </strong>
                    {preview && <span className="conv-preview">{preview.slice(0, 80)}</span>}
                    <span className="meta">
                      {c.type === 'GROUP' && `${c.memberCount || 0} members · `}
                      {c.lastMessageAt && new Date(c.lastMessageAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
}
