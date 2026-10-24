'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { readerService } from '@/features/library/sdk/library.client';
import { readerQueryKeys } from '@/features/library/sdk/query-keys';
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
 * 1. Polls RAG indexing status while pending.
 * 2. Restores last saved reading page on initial paper load.
 * 3. Debounces page updates back to the server as the user scrolls.
 * 4. Marks the document as read on first open.
 */
export function useReadingProgress({
  scopeId,
  paper,
  effectivePaperId,
  visiblePage,
  setVisiblePage,
  setTargetPage,
}: UseReadingProgressOptions): void {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const hasExplicitDeepLink = Boolean(
    searchParams?.get('page') || searchParams?.get('annotation'),
  );

  // 1. Poll RAG status while pending
  useEffect(() => {
    const ragStatus = (paper as { ragStatus?: string } | undefined)?.ragStatus;
    if (!paper || ragStatus !== 'pending') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: readerQueryKeys.item(scopeId, effectivePaperId) });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, scopeId, effectivePaperId, qc]);

  // 2. Restore reading state on paper load
  const restoredPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    restoredPaperIdRef.current = paper.id;

    readerService.state
      .getState(scopeId, paper.id)
      .then((stateData) => {
        // Do not let async getState overwrite explicit URL deep-links (?page= or ?annotation=)
        if (hasExplicitDeepLink) return;
        if (stateData?.currentPage && stateData.currentPage > 1) {
          setTargetPage({ pageNumber: stateData.currentPage, timestamp: Date.now() });
          setVisiblePage(stateData.currentPage);
        }
      })
      .catch(() => undefined);
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
