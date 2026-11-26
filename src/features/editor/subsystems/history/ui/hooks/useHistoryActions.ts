import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { pagesService, historyKeys } from '@/features/editor/sdk/pages.service';
import { exportVersionAsZip } from '@/features/editor/sdk/archive/zip-export';
import {
  clearYjsProviderPool,
  evictYjsProviderByDocId,
} from '@/features/editor/sdk/realtime/provider';
import {
  editorCommandBus,
  sessionCoordinator,
  documentFacade,
} from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  clearAllOfflineMemory,
} from '@/features/editor/domain/offline-storage';
import type {
  ProjectDiffResponse,
  ProjectSnapshotDetail,
} from '@/features/editor/domain/types/history.types';
import type { HistoryMode } from './useHistoryState';

interface UseHistoryActionsOptions {
  open: boolean;
  spaceId: string;
  pageId: string;
  projectTitle: string;
  mode: HistoryMode;
  targetVersion: number | null;
  baseVersion: number | null;
  activeFile: string | null;
  onRestoredProject: () => void;
  onRestoredFile: () => void;
}

export function useHistoryActions({
  open,
  spaceId,
  pageId,
  projectTitle,
  mode,
  targetVersion,
  baseVersion,
  activeFile,
  onRestoredProject,
  onRestoredFile,
}: UseHistoryActionsOptions) {
  const queryClient = useQueryClient();
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const scope = useMemo(() => (pageId ? { pageId } : undefined), [pageId]);

  const invalidateHistoryCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['history'] });
    queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
    queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  }, [queryClient]);

  // ── Queries ──
  const {
    data: versions = [],
    isLoading: isLoadingVersions,
    error: versionsError,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: historyKeys.versions(spaceId, pageId || undefined),
    queryFn: () => pagesService.history.getProjectVersions(spaceId, scope),
    enabled: !!spaceId && open,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Flush pending live Yjs edits into history when opening History view
  useEffect(() => {
    if (!open || !spaceId) return;
    let cancelled = false;
    void pagesService.history
      .flushHistory(spaceId, scope)
      .then((res) => {
        if (!cancelled && res?.flushed) {
          void refetchVersions();
        }
      })
      .catch(() => {
        // Non-fatal: history list still renders latest persisted snapshots
      });
    return () => {
      cancelled = true;
    };
  }, [open, spaceId, scope, refetchVersions]);

  const canCompare =
    mode === 'compare' &&
    !!spaceId &&
    baseVersion !== null &&
    targetVersion !== null &&
    baseVersion !== targetVersion;

  const {
    data: diffData,
    isLoading: isLoadingDiff,
    error: diffError,
    refetch: refetchDiff,
  } = useQuery<ProjectDiffResponse | null>({
    queryKey: ['project-history-diff', spaceId, pageId, baseVersion, targetVersion],
    queryFn: () =>
      pagesService.history.compareProjectVersions(spaceId, baseVersion!, targetVersion!, scope),
    enabled: canCompare && open,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const {
    data: snapshot,
    isLoading: isLoadingSnapshot,
    error: snapshotError,
    refetch: refetchSnapshot,
  } = useQuery<ProjectSnapshotDetail | null>({
    queryKey: ['project-snapshot', spaceId, pageId, targetVersion],
    queryFn: () =>
      targetVersion ? pagesService.history.getProjectSnapshot(spaceId, targetVersion, scope) : null,
    enabled: !!spaceId && targetVersion !== null && open,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // ── Mutations ──
  const addLabel = useMutation({
    mutationFn: ({ version, label }: { version: number; label: string }) =>
      pagesService.history.labelProjectVersion(spaceId, version, label, scope),
    onSuccess: () => void refetchVersions(),
    onError: (err: unknown, vars) => {
      toast.error(`Failed to add label: ${(err as Error)?.message || 'Unknown error'}`, {
        id: `history-label-${vars.version}`,
      });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (labelId: string) =>
      pagesService.history.deleteProjectLabel(spaceId, labelId, scope),
    onSuccess: () => void refetchVersions(),
    onError: (err: unknown, labelId) => {
      toast.error(`Failed to remove label: ${(err as Error)?.message || 'Unknown error'}`, {
        id: `history-label-${labelId}`,
      });
    },
  });

  const restoreProject = useMutation({
    mutationFn: async (version: number) => {
      for (const m of lruDocumentCache.getAllModels()) {
        sessionCoordinator.cancelPendingAutoSave(m.fileId);
      }
      return pagesService.history.restoreProjectVersion(spaceId, version, scope);
    },
    onSuccess: (_, restoredVersion) => {
      sessionCoordinator.resetSession();
      clearYjsProviderPool({ skipFlush: true });
      for (const m of lruDocumentCache.getDirtyModels()) {
        lruDocumentCache.markClean(m.fileId);
        void unsyncedEditsStore.clear(m.fileId);
      }
      for (const m of lruDocumentCache.getAllModels()) {
        void unsyncedEditsStore.clear(m.fileId);
      }
      if (spaceId) {
        documentFacade.clearProjectCache(spaceId);
        void unsyncedEditsStore.clearByScope(spaceId);
      }
      clearAllOfflineMemory();
      lruDocumentCache.discardAll();
      useCompileStore.getState().clearAllDirty();
      invalidateHistoryCaches();
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success(`Restored project to v${restoredVersion}`, { id: 'history-restore' });
      onRestoredProject();
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore project: ${(err as Error)?.message || 'Unknown error'}`, {
        id: 'history-restore',
      });
    },
  });

  const restoreFile = useMutation({
    mutationFn: async (versionOverride?: number) => {
      const version = versionOverride ?? (mode === 'single' ? targetVersion : baseVersion);
      if (!spaceId || !version || !activeFile) {
        throw new Error('Missing project, version or file information');
      }
      const cached = lruDocumentCache.findByPath(activeFile);
      if (cached) {
        sessionCoordinator.cancelPendingAutoSave(cached.fileId);
      }
      const restored = await pagesService.history.restoreProjectVersionFile(
        spaceId,
        version,
        activeFile,
        undefined,
        scope,
      );
      return {
        filePath: restored.path || activeFile,
        docId: restored.docId ?? undefined,
        version,
        content: restored.content ?? '',
        rev: restored.rev,
      };
    },
    onSuccess: ({ filePath, docId, version, content, rev }) => {
      toast.success(`Restored ${filePath} from v${version}`, {
        id: `history-restore-${filePath}`,
      });
      onRestoredFile();

      const syncDocCache = (id: string) => {
        sessionCoordinator.cancelPendingAutoSave(id);
        evictYjsProviderByDocId(id, { skipFlush: true });
        lruDocumentCache.clearServerRev(id);
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(id, rev);
        }
        lruDocumentCache.updateContent(id, content, false);
        lruDocumentCache.markClean(id);
        useCompileStore.getState().clearDirty(id);
        void unsyncedEditsStore.clear(id);
      };

      let updatedMountedEngine = false;
      if (docId) {
        syncDocCache(docId);
        const engine = documentFacade.getEditorEngineForFile(docId);
        if (engine) {
          engine.setContent(content);
          updatedMountedEngine = true;
        }
      }
      const cachedByPath = lruDocumentCache.findByPath(filePath);
      if (cachedByPath && cachedByPath.fileId !== docId) {
        syncDocCache(cachedByPath.fileId);
      }

      invalidateHistoryCaches();
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      if (!updatedMountedEngine) {
        editorCommandBus.dispatch({
          type: 'document:content-updated',
          docId: docId || filePath,
          content,
        });
      }
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore file: ${(err as Error)?.message || 'Unknown error'}`, {
        id: 'history-restore-file',
      });
    },
  });

  const downloadZip = useCallback(
    async (versionOverride?: number) => {
      const version = versionOverride ?? targetVersion;
      if (!spaceId || !version || isDownloadingZip) return;
      setIsDownloadingZip(true);
      try {
        await exportVersionAsZip({
          projectId: spaceId,
          pageId: pageId || undefined,
          version,
          projectTitle: projectTitle || 'project',
        });
      } catch (err: unknown) {
        toast.error(
          `Failed to download Version ZIP: ${(err as Error)?.message || 'Unknown error'}`,
          { id: 'history-download-zip' },
        );
      } finally {
        setIsDownloadingZip(false);
      }
    },
    [spaceId, pageId, projectTitle, targetVersion, isDownloadingZip],
  );

  return {
    versions,
    isLoadingVersions,
    versionsError,
    refetchVersions,
    diffData,
    isLoadingDiff,
    diffError,
    refetchDiff,
    snapshot,
    isLoadingSnapshot,
    snapshotError,
    refetchSnapshot,
    addLabel,
    deleteLabel,
    restoreProject,
    restoreFile,
    downloadZip,
  };
}
