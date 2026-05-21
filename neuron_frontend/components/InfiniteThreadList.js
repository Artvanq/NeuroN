import { useEffect, useRef } from 'react';
import ThreadCard from './ThreadCard';
import Loading from './Loading';

export default function InfiniteThreadList({
  threads,
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
  empty,
  endLabel,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '280px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore, threads.length]);

  if (loading && threads.length === 0) {
    return <Loading label="Loading questions…" />;
  }

  if (!loading && threads.length === 0) {
    return empty || <p className="muted">Nothing here yet.</p>;
  }

  return (
    <>
      <ul className="thread-list">
        {threads.map((thread) => (
          <ThreadCard key={thread._id} thread={thread} />
        ))}
      </ul>
      <div className="infinite-scroll-foot">
        {loadingMore && <Loading label="Loading more…" />}
        {hasMore && <div ref={sentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />}
        {!hasMore && threads.length > 0 && endLabel && (
          <p className="muted infinite-scroll-end">{endLabel}</p>
        )}
      </div>
    </>
  );
}
