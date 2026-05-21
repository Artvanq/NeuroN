import { useState, useCallback, useRef, useEffect } from 'react';

export const THREAD_PAGE_SIZE = 20;

export function useInfiniteThreads({ fetchPage, resetKey, enabled = true }) {
  const [threads, setThreads] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const loadingMoreRef = useRef(false);

  const loadInitial = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setThreads([]);
    setNextCursor(null);
    try {
      const data = await fetchPage({ cursor: null });
      setThreads(data.threads || []);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, enabled]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial, resetKey]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchPage({ cursor: nextCursor });
      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t._id));
        const added = (data.threads || []).filter((t) => !seen.has(t._id));
        return [...prev, ...added];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchPage, nextCursor, loading]);

  return {
    threads,
    loading,
    loadingMore,
    error,
    loadMore,
    hasMore: Boolean(nextCursor),
    reload: loadInitial,
  };
}
