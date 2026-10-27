'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { StateService } from '@/features/library/sdk/library.client';
import { itemKeys, normalizeScopeId } from '@/features/library/sdk/query-keys';
import { patchItemAcrossScopeCaches } from '@/features/library/sdk/queries/cache-patcher';
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

  // 1. Restore reading state on paper load
  const restoredPaperIdRef = useRef<string | null>(null);
  const isRestoredRef = useRef<boolean>(false);
  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    restoredPaperIdRef.current = paper.id;
    isRestoredRef.current = false;
    let isCancelled = false;

    StateService
      .getState(scopeId, paper.id)
      .then((stateData) => {
        if (isCancelled) return;
        if (!hasExplicitDeepLink && stateData?.currentPage && stateData.currentPage > 1) {
          setTargetPage({ pageNumber: stateData.currentPage, timestamp: Date.now() });
          setVisiblePage(stateData.currentPage);
        }
        isRestoredRef.current = true;
      })
      .catch(() => {
        if (!isCancelled) {
          isRestoredRef.current = true;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [paper?.id, scopeId, setTargetPage, setVisiblePage, hasExplicitDeepLink]);

  // 3. Debounced update reading state when page changes (supports saving when returning to page 1)
  useEffect(() => {
    if (!paper?.id || visiblePage < 1 || !isRestoredRef.current) return;
    const paperId = paper.id;
    const timeout = setTimeout(() => {
      StateService
        .updateState(effectiveScope, paperId, {
          currentPage: visiblePage,
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

  // 4. Mark paper as read once per paper load
  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      const paperId = paper.id;
      markedPaperIdRef.current = paperId;
      StateService
        .markAsRead(effectiveScope, paperId)
        .then(() => {
          patchItemAcrossScopeCaches(queryClient, effectiveScope, paperId, {
            isRead: true,
            readStatus: 'reading',
            lastReadAt: new Date().toISOString(),
          });
          void queryClient.invalidateQueries({
            queryKey: itemKeys.state(effectiveScope, paperId),
          });
        })
        .catch(() => undefined);
    }
  }, [effectiveScope, paper?.id, queryClient]);
}
