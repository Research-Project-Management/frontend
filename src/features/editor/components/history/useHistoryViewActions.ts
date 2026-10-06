'use client';

/**
 * useHistoryViewActions.ts
 *
 * Dedicated custom hook encapsulating history view actions and notifications:
 * - Scrub timeline point restoration
 * - Single file revision restoration
 * - Entire project version restoration (with React Query cache invalidation)
 *
 * Adheres strictly to the architectural constraint:
 * All toasts live exclusively inside hooks; presentation components do not hold toast.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { historyService } from '@/features/editor/services/history.service';
import { historyKeys } from '@/features/editor/hooks/use-history';
import { filesQuery } from '@/features/editor/hooks/use-core';

export interface UseHistoryViewActionsOptions {
  projectId?: string;
  rootPageId?: string;
  engine?: any;
}

export function useHistoryViewActions(options?: UseHistoryViewActionsOptions) {
  const queryClient = useQueryClient();
  const { projectId, rootPageId, engine } = options || {};
  const [isRestoringProject, setIsRestoringProject] = useState(false);

  const restoreScrubPoint = useCallback(
    (
      targetPageId: string | undefined,
      scrubContent: string | undefined,
      scrubTimestamp: number,
      updateContentMutation: any,
      onSuccess?: () => void,
    ) => {
      if (scrubContent === undefined) return;
      if (targetPageId) {
        updateContentMutation.mutate(
          {
            pageId: targetPageId,
            content: scrubContent,
          },
          {
            onSuccess: () => {
              engine?.setContent(scrubContent);
              toast.success(
                `Document restored to ${new Date(scrubTimestamp).toLocaleTimeString()} successfully!`,
              );
              if (onSuccess) onSuccess();
            },
          },
        );
      } else {
        engine?.setContent(scrubContent);
        if (onSuccess) onSuccess();
      }
    },
    [engine],
  );

  const restoreFileRevision = useCallback(
    (
      fileId: string,
      fileName: string,
      contentToRestore: string,
      activeFilePageId: string | undefined,
      updateContentMutation: any,
      onSuccess?: () => void,
    ) => {
      updateContentMutation.mutate(
        {
          pageId: fileId,
          content: contentToRestore,
        },
        {
          onSuccess: () => {
            if (fileId === activeFilePageId) {
              engine?.setContent(contentToRestore);
            }
            toast.success(`Restored "${fileName}" to this revision successfully!`);
            if (onSuccess) onSuccess();
          },
        },
      );
    },
    [engine],
  );

  const restoreProjectVersion = useCallback(
    async (versionNumber: number, onSuccess?: () => void) => {
      const targetId = projectId || rootPageId;
      if (!targetId) return;

      setIsRestoringProject(true);
      try {
        await historyService.restoreProjectVersion(targetId, versionNumber);
        toast.success(`Project restored to Version ${versionNumber} successfully!`);
        queryClient.invalidateQueries({ queryKey: historyKeys.byProject(targetId) });
        if (rootPageId) {
          queryClient.invalidateQueries({ queryKey: filesQuery(rootPageId).queryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['pages'] });
        if (onSuccess) onSuccess();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to restore project version');
      } finally {
        setIsRestoringProject(false);
      }
    },
    [projectId, rootPageId, queryClient],
  );

  return {
    isRestoringProject,
    restoreScrubPoint,
    restoreFileRevision,
    restoreProjectVersion,
  };
}
