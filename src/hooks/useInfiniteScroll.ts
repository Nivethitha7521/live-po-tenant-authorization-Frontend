import { useCallback, useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  root?: Element | null;
  onLoadMore: () => void | Promise<void>;
  isLoading?: boolean;
  hasMore?: boolean;
  enabled?: boolean;
}

export const useInfiniteScroll = ({
  threshold = 0,
  rootMargin = '0px',
  root = null,
  onLoadMore,
  isLoading = false,
  hasMore = true,
  enabled = true,
}: UseInfiniteScrollOptions) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading && enabled) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, enabled, onLoadMore]
  );

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
      root,
    });

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection, threshold, rootMargin, root, enabled]);

  useEffect(() => {
    if (!hasMore && observerRef.current && sentinelRef.current) {
      observerRef.current.unobserve(sentinelRef.current);
    }
  }, [hasMore]);

  return {
    sentinelRef,
    isObserving: !!observerRef.current && hasMore && enabled,
  };
};
