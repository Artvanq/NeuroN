import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import ThreadFeedSection from '../../components/ThreadFeedSection';
import Loading from '../../components/Loading';
import ProfileActions from '../../components/ProfileActions';
import UserProjectsSection from '../../components/UserProjectsSection';
import { getUser, getErrorMessage } from '../../lib/api';
import { getStoredUser, isLoggedIn } from '../../lib/auth';
import { useI18n } from '../../lib/I18nContext';
import { useInfiniteThreads } from '../../lib/useInfiniteThreads';
import { createThreadFetchPage } from '../../lib/createThreadFetchPage';

export default function UserProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canLoadThreads = Boolean(username) && user?.access?.canViewContent !== false;

  const fetchPage = useMemo(
    () =>
      createThreadFetchPage({
        mode: 'user',
        username,
        searchQuery,
      }),
    [username, searchQuery]
  );

  const {
    threads,
    loading: threadsLoading,
    loadingMore,
    error: threadsError,
    loadMore,
    hasMore,
  } = useInfiniteThreads({
    fetchPage,
    resetKey: `${username}:${searchQuery}`,
    enabled: canLoadThreads,
  });

  useEffect(() => {
    if (!username) return;
    setUserLoading(true);
    setUserError(null);
    getUser(username)
      .then(setUser)
      .catch((err) => setUserError(getErrorMessage(err)))
      .finally(() => setUserLoading(false));
  }, [username]);

  const me = typeof window !== 'undefined' ? getStoredUser() : null;
  const isSelf = me?.username === username;

  if (userLoading) {
    return (
      <Layout title={String(username)}>
        <Loading label="Loading mind…" />
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout title="Not found">
        <p className="error">{userError || 'User not found'}</p>
      </Layout>
    );
  }

  const listError = threadsError ? getErrorMessage(threadsError) : null;
  const visibilityLabel = {
    OPEN: 'Open profile',
    REQUEST: 'Messages by request',
    CLOSED: 'Closed profile',
  }[user.access?.profileVisibility || user.profileVisibility || 'OPEN'];

  return (
    <Layout title={user.displayName || user.username}>
      {user.mindStatement && user.access?.canViewContent !== false && (
        <blockquote className="profile-mind">{user.mindStatement}</blockquote>
      )}
      {user.isBanned && (
        <p className="error panel">
          This account is currently moderated/banned.
          {user.bannedReason ? ` Reason: ${user.bannedReason}` : ''}
        </p>
      )}

      <div className="profile-hero">
        {user.avatarUrl && (
          <img src={user.avatarUrl} alt="" className="profile-avatar" width={72} height={72} />
        )}
        <PageHeader
          eyebrow={visibilityLabel}
          title={user.displayName || user.username}
          description={
            <>
              @{user.username}
              {user.createdAt && (
                <> · joined {new Date(user.createdAt).toLocaleDateString()}</>
              )}
              {user.profileUrl && user.access?.canViewContent !== false && (
                <>
                  {' '}
                  ·{' '}
                  <a href={user.profileUrl} target="_blank" rel="noopener noreferrer">
                    External profile
                  </a>
                </>
              )}
              {user.linkedProviders?.length > 0 && (
                <> · via {user.linkedProviders.join(', ')}</>
              )}
            </>
          }
          action={!isSelf ? <ProfileActions user={user} onBlockChange={(access) => setUser((u) => ({ ...u, access }))} /> : null}
        />
      </div>

      {user.access?.canViewContent === false && !isSelf && (
        <p className="muted panel">
          {user.access?.blocked || user.access?.blockedBy
            ? 'Content hidden — block in effect.'
            : 'This is a closed profile. Questions and mind statement are private.'}
        </p>
      )}

      {listError && <p className="error">{listError}</p>}

      {!isSelf && !isLoggedIn() && user.access?.profileVisibility === 'OPEN' && (
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Sign in to start a private dialogue.
        </p>
      )}

      {canLoadThreads && (
        <>
          <UserProjectsSection username={username} />
          <ThreadFeedSection
          title="Questions opened"
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchScopeHint={`${t('feed_search_scope_user')} · @${user.username}`}
          threads={threads}
          hasMore={hasMore}
          loading={threadsLoading}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          empty={<p className="muted">No open questions yet.</p>}
        />
        </>
      )}
    </Layout>
  );
}
