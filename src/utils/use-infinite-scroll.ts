import { useState, useEffect, useRef, useCallback, type RefObject } from "react";

interface UseInfiniteScrollOptions {
  totalCount: number;
  pageSize?: number;
  rootMargin?: string;
}

interface UseInfiniteScrollResult {
  visibleCount: number;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function useInfiniteScroll({
  totalCount,
  pageSize = 9,
  rootMargin = "200px",
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when total changes (e.g. item added/removed)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [totalCount, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, totalCount));
  }, [totalCount, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, rootMargin]);

  return {
    visibleCount,
    hasMore: visibleCount < totalCount,
    sentinelRef,
  };
}
