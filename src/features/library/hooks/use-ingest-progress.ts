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

export function useIngestProgress(workspaceId: string) {
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
        const progress = await IngestionService.getRunProgress(workspaceId, runId);
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
          queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
          queryClient.invalidateQueries({ queryKey: ['library', workspaceId] });
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['papers'] });
        } else {
          pollTimerRef.current = setTimeout(() => poll(runId), 600);
        }
      } catch {
        if (activeRunIdRef.current === runId) {
          // Retry on transient poll error
          pollTimerRef.current = setTimeout(() => poll(runId), 1200);
        }
      }
    },
    [workspaceId, queryClient, stopPolling],
  );

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
          workspaceId,
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
    [workspaceId, poll, stopPolling],
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
          workspaceId,
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
    [workspaceId, stopPolling],
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
        const items = prev.data.items.map((item) => {
          if (item.title === fileName) {
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
        const percentage = Math.round((processed / total) * 100);
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
        return {
          ...prev,
          isComplete: true,
          error: errorMessage || null,
          data: {
            ...prev.data,
            status: errorMessage ? 'FAILED_FINAL' : 'COMPLETED',
            percentage: 100,
            completedAt: new Date().toISOString(),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['library', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    [workspaceId, queryClient],
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
