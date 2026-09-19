'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IngestionService, type IngestionProgressResponse } from '../services/ingestion.service';
import { itemKeys } from './use-items';

export interface ProcessModalState {
  isOpen: boolean;
  isMinimized: boolean;
  runId: string | null;
  fileName: string;
  data: IngestionProgressResponse | null;
  isComplete: boolean;
  error: string | null;
}

export function useIngestProgress(scopeId: string = 'user') {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ProcessModalState>({
    isOpen: false,
    isMinimized: false,
    runId: null,
    fileName: '',
    data: null,
    isComplete: false,
    error: null,
  });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const pollRef = useRef<((runId: string) => Promise<void>) | undefined>(undefined);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (runId: string) => {
      if (activeRunIdRef.current !== runId) return;

      try {
        const progress = await IngestionService.getRunProgress(scopeId, runId);
        if (activeRunIdRef.current !== runId) return;

        const isTerminal =
          progress.status === 'READY' ||
          progress.status === 'COMPLETED' ||
          progress.status === 'FAILED_FINAL' ||
          progress.status === 'FAILED_RETRYABLE';

        setModalState((prev) => ({
          ...prev,
          data: progress,
          isComplete: isTerminal,
          error:
            progress.status === 'FAILED_FINAL' || progress.status === 'FAILED_RETRYABLE'
              ? 'Ingestion was interrupted or encountered errors.'
              : null,
        }));

        if (isTerminal) {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
          queryClient.invalidateQueries({ queryKey: ['library', scopeId] });
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['papers'] });
        } else {
          // IP-1: Use pollRef so the closure always invokes the latest poll function
          pollTimerRef.current = setTimeout(() => pollRef.current?.(runId), 600);
        }
      } catch {
        if (activeRunIdRef.current === runId) {
          // Retry on transient poll error
          // IP-1: Use pollRef so the closure always invokes the latest poll function
          pollTimerRef.current = setTimeout(() => pollRef.current?.(runId), 1200);
        }
      }
    },
    [scopeId, queryClient, stopPolling],
  );

  // IP-1: Keep pollRef in sync with the latest poll callback after every render
  pollRef.current = poll;

  const startMonitoring = useCallback(
    (runId: string, fileName = 'References') => {
      stopPolling();
      activeRunIdRef.current = runId;
      setModalState({
        isOpen: true,
        isMinimized: false,
        runId,
        fileName,
        data: {
          runId,
          scopeId,
          status: 'RECEIVED',
          total: 1,
          processed: 0,
          percentage: 0,
          succeeded: 0,
          duplicates: 0,
          failed: 0,
          currentTitle: fileName,
          items: [],
          startedAt: new Date().toISOString(),
        },
        isComplete: false,
        error: null,
      });

      // Kickoff poll
      pollTimerRef.current = setTimeout(() => poll(runId), 300);
    },
    [scopeId, poll, stopPolling],
  );

  const startBatchProgress = useCallback(
    (files: { id?: string; name: string }[], batchTitle = '') => {
      stopPolling();
      activeRunIdRef.current = null;
      const total = files.length;
      const title = batchTitle || (total === 1 ? files[0].name : `${total} documents`);
      setModalState({
        isOpen: true,
        isMinimized: false,
        runId: 'batch-upload',
        fileName: title,
        data: {
          runId: 'batch-upload',
          scopeId,
          status: 'PROCESSING',
          total,
          processed: 0,
          percentage: 0,
          succeeded: 0,
          duplicates: 0,
          failed: 0,
          currentTitle: files[0]?.name || title,
          items: files.map((f, idx) => ({
            title: f.name,
            status: (idx === 0 ? 'PROCESSING' : 'PENDING') as any,
          })),
          startedAt: new Date().toISOString(),
        },
        isComplete: false,
        error: null,
      });
    },
    [scopeId, stopPolling],
  );

  const updateBatchItem = useCallback(
    (
      fileName: string,
      status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING',
      error?: string,
      itemName?: string,
    ) => {
      setModalState((prev) => {
        if (!prev.data) return prev;
        let matched = false;
        const normalizedTarget = (fileName || '').trim().toLowerCase();
        const baseTarget = normalizedTarget.split(/[/\\]/).pop() || normalizedTarget;

        const items = prev.data.items.map((item) => {
          const itemTitle = (item.title || '').trim().toLowerCase();
          const itemBase = itemTitle.split(/[/\\]/).pop() || itemTitle;
          const isMatch =
            item.title === fileName ||
            itemTitle === normalizedTarget ||
            itemBase === baseTarget;

          if (isMatch) {
            matched = true;
            return {
              ...item,
              status: status as any,
              error: error || item.error,
              itemName: itemName || (item as any).itemName,
            };
          }
          return item;
        });

        const finalItems = matched
          ? items
          : [...items, { title: fileName, status: status as any, error, itemName } as any];
        const processed = finalItems.filter((i) => i.status === 'SUCCEEDED' || i.status === 'DUPLICATE' || i.status === 'FAILED').length;
        const succeeded = finalItems.filter((i) => i.status === 'SUCCEEDED').length;
        const duplicates = finalItems.filter((i) => i.status === 'DUPLICATE').length;
        const failed = finalItems.filter((i) => i.status === 'FAILED').length;
        const total = Math.max(prev.data.total, finalItems.length);
        const percentage = Math.min(100, Math.round((processed / total) * 100));
        const isComplete = processed >= total && total > 0;

        return {
          ...prev,
          isComplete,
          data: {
            ...prev.data,
            items: finalItems,
            processed,
            succeeded,
            duplicates,
            failed,
            percentage,
            currentTitle: fileName,
            completedAt: isComplete ? new Date().toISOString() : undefined,
          },
        };
      });
    },
    [],
  );

  const finishBatchProgress = useCallback(
    (errorMessage?: string) => {
      setModalState((prev) => {
        if (!prev.data) return prev;
        const updatedItems = prev.data.items.map((item) => {
          const itemStatus = item.status as string;
          const isStillRunning =
            itemStatus !== 'SUCCEEDED' &&
            itemStatus !== 'FAILED' &&
            itemStatus !== 'DUPLICATE';

          if (!errorMessage && isStillRunning) {
            return {
              ...item,
              status: 'SUCCEEDED' as const,
              itemName: (item as any).itemName || item.title,
            };
          }
          return item;
        });

        const succeeded = updatedItems.filter((i) => i.status === 'SUCCEEDED').length;
        const duplicates = updatedItems.filter((i) => i.status === 'DUPLICATE').length;
        const failed = updatedItems.filter((i) => i.status === 'FAILED').length;

        return {
          ...prev,
          isComplete: true,
          error: errorMessage || null,
          data: {
            ...prev.data,
            items: updatedItems,
            processed: updatedItems.length,
            succeeded,
            duplicates,
            failed,
            status: errorMessage ? 'FAILED_FINAL' : 'COMPLETED',
            percentage: 100,
            completedAt: new Date().toISOString(),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      queryClient.invalidateQueries({ queryKey: ['library', scopeId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    [scopeId, queryClient],
  );

  const closeModal = useCallback(() => {
    stopPolling();
    activeRunIdRef.current = null;
    setModalState((prev) => ({ ...prev, isOpen: false, runId: null }));
  }, [stopPolling]);

  const toggleMinimize = useCallback(() => {
    setModalState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      activeRunIdRef.current = null;
    };
  }, [stopPolling]);

  return {
    modalState,
    startMonitoring,
    startBatchProgress,
    updateBatchItem,
    finishBatchProgress,
    closeModal,
    toggleMinimize,
  };
}
