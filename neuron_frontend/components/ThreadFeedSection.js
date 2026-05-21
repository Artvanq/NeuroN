import Link from 'next/link';
import FeedSearch from './FeedSearch';
import InfiniteThreadList from './InfiniteThreadList';
import { useI18n } from '../lib/I18nContext';

export default function ThreadFeedSection({
  title,
  searchQuery,
  onSearchQueryChange,
  searchScopeHint,
  searchUsers,
  searchProjects,
  searchOrganizations,
  searchMessages,
  threads,
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  empty,
}) {
  const { t } = useI18n();

  return (
    <section className="panel thread-feed-section">
      {title && (
        <div className="panel-head-row">
          <h2>{title}</h2>
        </div>
      )}

      <FeedSearch
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        scopeHint={searchScopeHint}
      />

      {searchOrganizations && searchOrganizations.length > 0 && (
        <div className="feed-search-projects">
          <h3 className="feed-search-minds-title">{t('search_orgs')}</h3>
          <ul className="user-search-list user-search-list-compact">
            {searchOrganizations.map((o) => (
              <li key={o._id}>
                <Link href={`/orgs/${o.slug}`}>
                  <strong>{o.name}</strong>
                  <span className="muted"> @{o.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {searchProjects && searchProjects.length > 0 && (
        <div className="feed-search-projects">
          <h3 className="feed-search-minds-title">{t('search_projects')}</h3>
          <ul className="project-list project-list-compact">
            {searchProjects.map((p) => {
              const owner = p.ownerUsername || p.owner?.username;
              const href = owner ? `/p/${owner}/${p.slug}` : '/projects';
              return (
                <li key={p._id} className="project-list-item panel-inset">
                  <Link href={href} className="project-list-link">
                    <span className="project-list-name">
                      <span className="project-owner">{owner}/</span>
                      {p.slug}
                    </span>
                    <span className="project-list-title">{p.name}</span>
                    {p.description && (
                      <span className="project-list-desc muted">{p.description}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {searchUsers && searchUsers.length > 0 && (
        <div className="feed-search-minds">
          <h3 className="feed-search-minds-title">{t('search_minds')}</h3>
          <ul className="user-search-list user-search-list-compact">
            {searchUsers.map((u) => (
              <li key={u._id}>
                <Link href={`/u/${u.username}`}>
                  <strong>{u.displayName || u.username}</strong>
                  <span className="muted"> @{u.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {searchMessages && searchMessages.length > 0 && (
        <div className="feed-search-messages">
          <h3 className="feed-search-minds-title">Messages</h3>
          <ul className="invite-list">
            {searchMessages.map((m) => (
              <li key={m._id} className="panel-inset">
                <Link href={`/messages/${m.conversation?._id}`}>
                  <strong>
                    {m.conversation?.name || m.sender?.displayName || m.sender?.username || 'Conversation'}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {new Date(m.createdAt).toLocaleString()}
                  </span>
                  <div className="muted">{m.body}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <InfiniteThreadList
        threads={threads}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        endLabel={t('feed_end')}
        empty={empty}
      />
    </section>
  );
}
