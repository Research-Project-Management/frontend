'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { StateService } from '@/features/library/sdk/library.client';
import { itemKeys, normalizeScopeId } from '@/features/library/sdk/query-keys';
import { patchItemAcrossScopeCaches } from '@/features/library/sdk/queries/cache-patcher';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import type {
  ReaderDocument,
  ReaderNavigationTarget,
} from '@/features/library/domain/types/reader.types';

export interface UseReadingProgressOptions {
  scopeId: string;
  paper: ReaderDocument | null;
  effectivePaperId: string;
  visiblePage: number;
  setVisiblePage: (page: number) => void;
  setTargetPage: (target: ReaderNavigationTarget | null) => void;
}

/**
 * Manages PDF Reader progress lifecycle:
 * 1. Restores last saved reading page on initial paper load.
 * 2. Debounces page updates back to the server as the user scrolls.
 * 3. Marks the document as read on first open.
 */
export function useReadingProgress({
  scopeId,
  paper,
  visiblePage,
  setVisiblePage,
  setTargetPage,
}: UseReadingProgressOptions): void {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const hasExplicitDeepLink = Boolean(
    searchParams?.get('page') || searchParams?.get('annotation'),
  );

  // 1. Restore reading state & bookmarks on paper load
  const restoredPaperIdRef = useRef<string | null>(null);
  const isInitialStateLoadedRef = useRef<boolean>(false);
  const lastSavedPageRef = useRef<number | null>(null);
  const pendingPageUpdateRef = useRef<{ scope: string; paperId: string; page: number } | null>(null);
  const hydratedBookmarksRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    restoredPaperIdRef.current = paper.id;
    isInitialStateLoadedRef.current = false;
    let isCancelled = false;

    const applyHydratedState = (
      currentPage?: number | null,
      scrollPosition?: unknown,
    ) => {
      if (isCancelled) return;
      if (scrollPosition && typeof scrollPosition === 'object' && 'bookmarks' in scrollPosition) {
        const rawBookmarks = (scrollPosition as { bookmarks?: unknown }).bookmarks;
        if (Array.isArray(rawBookmarks)) {
          useReaderStore.getState().setBookmarks(paper.id, rawBookmarks as number[]);
        }
      }
      hydratedBookmarksRef.current = JSON.stringify(useReaderStore.getState().getBookmarks(paper.id));

      if (!hasExplicitDeepLink && currentPage && currentPage > 1) {
        lastSavedPageRef.current = currentPage;
        setTargetPage({ pageNumber: currentPage, timestamp: Date.now() });
        setVisiblePage(currentPage);
      } else {
        lastSavedPageRef.current = currentPage ?? 1;
      }
      isInitialStateLoadedRef.current = true;
    };

    const embeddedState = paper.readingState;
    const embeddedCurrentPage =
      embeddedState?.currentPage ??
      (paper as { currentPage?: number }).currentPage;

    if (embeddedState !== undefined || embeddedCurrentPage !== undefined) {
      applyHydratedState(embeddedCurrentPage, embeddedState?.scrollPosition);
      return () => {
        isCancelled = true;
      };
    }

    StateService
      .getState(scopeId, paper.id)
      .then((stateData) => {
        applyHydratedState(stateData?.currentPage, stateData?.scrollPosition);
      })
      .catch(() => {
        if (!isCancelled) {
          isInitialStateLoadedRef.current = true;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [paper, scopeId, setTargetPage, setVisiblePage, hasExplicitDeepLink]);

  // 2. Sync bookmark changes to backend ReadingState.scrollPosition
  const paperBookmarks = useReaderStore((s) => (paper?.id ? s.bookmarks[paper.id] : undefined));
  useEffect(() => {
    if (!paper?.id || !isInitialStateLoadedRef.current) return;
    const currentBookmarks = paperBookmarks ?? [];
    const serialized = JSON.stringify(currentBookmarks);
    if (hydratedBookmarksRef.current === serialized) return;
    hydratedBookmarksRef.current = serialized;

    const existingScrollPos =
      paper.readingState?.scrollPosition &&
      typeof paper.readingState.scrollPosition === 'object' &&
      !Array.isArray(paper.readingState.scrollPosition)
        ? (paper.readingState.scrollPosition as Record<string, unknown>)
        : {};

    StateService
      .updateState(effectiveScope, paper.id, {
        scrollPosition: {
          ...existingScrollPos,
          bookmarks: currentBookmarks,
        },
      })
      .then(() => {
        void queryClient.invalidateQueries({
          queryKey: itemKeys.state(effectiveScope, paper.id),
        });
      })
      .catch(() => undefined);
  }, [paperBookmarks, paper?.id, paper?.readingState?.scrollPosition, effectiveScope, queryClient]);

  // 3. Debounced update reading state when page changes, with unmount flush
  useEffect(() => {
    if (!paper?.id || visiblePage < 1 || !isInitialStateLoadedRef.current) return;
    if (lastSavedPageRef.current === visiblePage) {
      pendingPageUpdateRef.current = null;
      return;
    }

    const paperId = paper.id;
    pendingPageUpdateRef.current = {
      scope: effectiveScope,
      paperId,
      page: visiblePage,
    };

    const timeout = setTimeout(() => {
      const pending = pendingPageUpdateRef.current;
      pendingPageUpdateRef.current = null;
      lastSavedPageRef.current = visiblePage;
      StateService
        .updateState(effectiveScope, paperId, {
          currentPage: pending ? pending.page : visiblePage,
        })
        .then(() => {
          void queryClient.invalidateQueries({
            queryKey: itemKeys.state(effectiveScope, paperId),
          });
        })
        .catch(() => undefined);
    }, 800);

    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, effectiveScope, queryClient]);

  // Flush any pending debounced progress update on unmount
  useEffect(() => {
    return () => {
      const pending = pendingPageUpdateRef.current;
      if (pending && pending.page !== lastSavedPageRef.current) {
        pendingPageUpdateRef.current = null;
        void StateService
          .updateState(pending.scope, pending.paperId, {
            currentPage: pending.page,
          })
          .catch(() => undefined);
      }
    };
  }, []);

  // 4. Mark paper as read once per paper load
  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      const paperId = paper.id;
      markedPaperIdRef.current = paperId;
      StateService
        .markAsRead(effectiveScope, paperId)
        .then((updatedState) => {
          const nextReadStatus = updatedState?.readStatus || 'reading';
          patchItemAcrossScopeCaches(queryClient, effectiveScope, paperId, {
            isRead: nextReadStatus === 'completed',
            readStatus: nextReadStatus,
            lastReadAt: updatedState?.lastReadAt || new Date().toISOString(),
          });
          void queryClient.invalidateQueries({
            queryKey: itemKeys.state(effectiveScope, paperId),
          });
        })
        .catch(() => undefined);
    }
  }, [effectiveScope, paper?.id, queryClient]);
}
