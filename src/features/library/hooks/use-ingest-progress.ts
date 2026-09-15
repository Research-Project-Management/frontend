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
    closeModal,
    toggleMinimize,
  };
}
