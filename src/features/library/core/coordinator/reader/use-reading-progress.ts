'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { readerService } from '@/features/library/sdk/library.client';
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
  const hasExplicitDeepLink = Boolean(
    searchParams?.get('page') || searchParams?.get('annotation'),
  );

  // 1. Restore reading state on paper load
  const restoredPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    restoredPaperIdRef.current = paper.id;
    let isCancelled = false;

    readerService.state
      .getState(scopeId, paper.id)
      .then((stateData) => {
        if (isCancelled || hasExplicitDeepLink) return;
        if (stateData?.currentPage && stateData.currentPage > 1) {
          setTargetPage({ pageNumber: stateData.currentPage, timestamp: Date.now() });
          setVisiblePage(stateData.currentPage);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [paper?.id, scopeId, setTargetPage, setVisiblePage, hasExplicitDeepLink]);

  // 3. Debounced update reading state when page changes (supports saving when returning to page 1)
  useEffect(() => {
    if (!paper?.id || visiblePage < 1) return;
    const timeout = setTimeout(() => {
      readerService.state
        .updateState(scopeId, paper.id, {
          currentPage: visiblePage,
        })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, scopeId]);

  // 4. Mark paper as read once per paper load
  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      markedPaperIdRef.current = paper.id;
      readerService.state.markAsRead(scopeId || 'user', paper.id).catch(() => undefined);
    }
  }, [scopeId, paper?.id]);
}
