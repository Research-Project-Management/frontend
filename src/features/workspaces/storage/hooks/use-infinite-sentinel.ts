import { useRef, useEffect } from 'react';
import { useIntersectionObserver } from "@/shared/hooks";

export function useInfiniteSentinel({
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  rootMargin = '250px',
}: {
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { isIntersecting } = useIntersectionObserver(sentinelRef, {
    rootMargin,
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isFetchingNextPage, onLoadMore]);

  return sentinelRef;
}
