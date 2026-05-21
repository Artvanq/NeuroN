import { useEffect, useState } from 'react';
import { useI18n } from '../lib/I18nContext';

const MIN_LEN = 2;
const DEBOUNCE_MS = 350;

export default function FeedSearch({ query, onQueryChange, scopeHint }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(query || '');

  useEffect(() => {
    setDraft(query || '');
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = draft.trim();
      if (trimmed.length === 0) {
        if (query) onQueryChange('');
        return;
      }
      if (trimmed.length >= MIN_LEN && trimmed !== query) {
        onQueryChange(trimmed);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, query, onQueryChange]);

  const clear = () => {
    setDraft('');
    onQueryChange('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length >= MIN_LEN) onQueryChange(trimmed);
    else clear();
  };

  const active = query.length >= MIN_LEN;

  return (
    <form className="feed-search panel" role="search" onSubmit={handleSubmit}>
      <div className="feed-search-inner">
        <span className="feed-search-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
        </span>
        <input
          type="search"
          className="search-input feed-search-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('feed_search_placeholder')}
          aria-label={t('feed_search_placeholder')}
          minLength={MIN_LEN}
          autoComplete="off"
        />
        {(draft || active) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm feed-search-clear"
            onClick={clear}
            aria-label={t('feed_search_clear')}
          >
            ×
          </button>
        )}
      </div>
      {scopeHint && <p className="muted feed-search-hint">{scopeHint}</p>}
      {active && (
        <p className="muted feed-search-active">
          {t('feed_search_active')}: <strong>{query}</strong>
        </p>
      )}
    </form>
  );
}
