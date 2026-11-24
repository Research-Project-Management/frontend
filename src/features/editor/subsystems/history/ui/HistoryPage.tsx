'use client';

/**
 * HistoryPage.tsx
 *
 * Canonical Project History & Visual Diff Comparison Page (Overleaf Parity).
 * Location: `features/editor/subsystems/history/ui/HistoryPage.tsx`
 */

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  Columns2,
  AlignJustify,
  Loader2,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import { pagesService, historyKeys } from '@/features/editor/sdk/pages.service';
import { exportVersionAsZip } from '@/features/editor/sdk/archive/archive-export';
import {
  clearYjsProviderPool,
  evictYjsProviderByDocId,
} from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import {
  editorCommandBus,
  usePageStore,
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
import { VersionTimelineSidebar } from './VersionTimelineSidebar';
import { DiffContentPane } from './DiffContentPane';
import { HistoryFileTreeSidebar } from './HistoryFileTreeSidebar';

function findSnapshotFileEntry(
  files: ProjectSnapshotDetail['files'] | undefined,
  filePath: string | null,
) {
  if (!files || !filePath) return undefined;
  return (
    files[filePath] ||
    files[`/${filePath}`] ||
    files[filePath.replace(/^\//, '')]
  );
}

function extractSnapshotFileContent(
  fileData: ProjectSnapshotDetail['files'][string] | undefined,
): string {
  if (!fileData) return '';
  return typeof fileData === 'string'
    ? fileData
    : fileData.content ?? (fileData.lines ? fileData.lines.join('\n') : '');
}

interface HistoryPageProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  projectId?: string;
  pageId?: string;
  initialVersion?: number;
}

export function HistoryPage({
  open = true,
  onOpenChange,
  onClose,
  projectId: propProjectId,
  pageId: propPageId,
  initialVersion,
}: HistoryPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id ?? '');
  const currentPageTitle = usePageStore((s) => s.currentPage?.title ?? '');
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage) ?? '');
  const storeSpaceId = usePageStore((s) => s.spaceId);
  const storeRootPageId = usePageStore((s) => s.rootPageId || s.parentPageId || '');

  const effectivePageId =
    propPageId || params?.pageId || storeRootPageId || currentPageId || '';
  const effectiveProjectId =
    storeSpaceId ||
    propProjectId ||
    params?.projectId ||
    currentPageProjectId ||
    effectivePageId ||
    '';
  const pageScopeOpts = React.useMemo(
    () => (effectivePageId ? { pageId: effectivePageId } : undefined),
    [effectivePageId],
  );

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    if (onOpenChange) {
      onOpenChange(false);
      return;
    }
    const isPersonal = !params?.projectId || params.projectId === 'personal';
    if (isPersonal) {
      if (effectivePageId) {
        router.push(`/pages/${effectivePageId}`);
      } else {
        router.push('/pages');
      }
    } else if (effectivePageId) {
      router.push(`/projects/${params.projectId}/pages/${effectivePageId}`);
    } else {
      router.push(`/projects/${params.projectId}/pages`);
    }
  }, [onClose, onOpenChange, params?.projectId, effectivePageId, router]);

  // UI State
  const [historyMode, setHistoryMode] = useState<'single' | 'compare'>('single');
  const [filter, setFilter] = useState<'all' | 'labelled'>('all');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [selectedTargetVersion, setSelectedTargetVersion] = useState<number | null>(
    initialVersion || null
  );
  const [selectedBaseVersion, setSelectedBaseVersion] = useState<number | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Restore confirmation state
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [confirmingFileRestore, setConfirmingFileRestore] = useState(false);
  const skipNextRestoreResetRef = React.useRef(false);

  const prevSelectionRef = React.useRef({
    mode: historyMode,
    file: activeFilePath,
    base: selectedBaseVersion,
    target: selectedTargetVersion,
  });

  useEffect(() => {
    const prev = prevSelectionRef.current;
    if (
      prev.mode !== historyMode ||
      (prev.file && prev.file !== activeFilePath) ||
      (prev.base !== null && prev.base !== selectedBaseVersion) ||
      (prev.target !== null && prev.target !== selectedTargetVersion)
    ) {
      setConfirmingFileRestore(false);
    }
    if (prev.target !== null && prev.target !== selectedTargetVersion) {
      if (skipNextRestoreResetRef.current) {
        skipNextRestoreResetRef.current = false;
      } else {
        setConfirmingRestore(false);
      }
    }
    prevSelectionRef.current = {
      mode: historyMode,
      file: activeFilePath,
      base: selectedBaseVersion,
      target: selectedTargetVersion,
    };
  }, [historyMode, activeFilePath, selectedBaseVersion, selectedTargetVersion]);

  // ── Queries ──
  const {
    data: versions = [],
    isLoading: isLoadingVersions,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: historyKeys.versions(effectiveProjectId, effectivePageId || undefined),
    queryFn: () =>
      pagesService.history.getProjectVersions(effectiveProjectId, pageScopeOpts),
    enabled: !!effectiveProjectId && open,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Automatically select latest target version and target - 1 as base
  useEffect(() => {
    if (versions.length > 0) {
      if (selectedTargetVersion === null) {
        const latest = versions[0].version;
        setSelectedTargetVersion(latest);
        const prev = versions.length > 1 ? versions[1].version : Math.max(1, latest - 1);
        setSelectedBaseVersion(prev);
      } else if (selectedBaseVersion === null) {
        const foundIdx = versions.findIndex((v) => v.version === selectedTargetVersion);
        if (foundIdx >= 0 && foundIdx < versions.length - 1) {
          setSelectedBaseVersion(versions[foundIdx + 1].version);
        } else {
          setSelectedBaseVersion(Math.max(1, selectedTargetVersion - 1));
        }
      }
    }
  }, [versions, selectedTargetVersion, selectedBaseVersion]);

  // Compute diff query
  const canCompare =
    historyMode === 'compare' &&
    !!effectiveProjectId &&
    selectedBaseVersion !== null &&
    selectedTargetVersion !== null &&
    selectedBaseVersion !== selectedTargetVersion;

  const {
    data: diffData,
    isLoading: isLoadingDiff,
  } = useQuery<ProjectDiffResponse | null>({
    queryKey: [
      'project-history-diff',
      effectiveProjectId,
      effectivePageId,
      selectedBaseVersion,
      selectedTargetVersion,
    ],
    queryFn: () =>
      pagesService.history.compareProjectVersions(
        effectiveProjectId,
        selectedBaseVersion!,
        selectedTargetVersion!,
        pageScopeOpts,
      ),
    enabled: canCompare && open,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Query target snapshot (for Single Version view and left File Tree)
  const { data: targetSnapshot, isLoading: isLoadingTargetSnapshot } =
    useQuery<ProjectSnapshotDetail | null>({
      queryKey: ['project-snapshot', effectiveProjectId, effectivePageId, selectedTargetVersion],
      queryFn: () =>
        selectedTargetVersion
          ? pagesService.history.getProjectSnapshot(
              effectiveProjectId,
              selectedTargetVersion,
              pageScopeOpts,
            )
          : null,
      enabled: !!effectiveProjectId && selectedTargetVersion !== null && open,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    });

  const sidebarFiles = React.useMemo(() => {
    if (historyMode === 'single') {
      return Object.keys(targetSnapshot?.files ?? {})
        .sort()
        .map((path) => ({ path }));
    }
    return (diffData?.files ?? []).map((f) => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    }));
  }, [historyMode, targetSnapshot, diffData]);

  // Automatically select first file when sidebar files load or change
  useEffect(() => {
    if (sidebarFiles.length > 0) {
      if (!activeFilePath || !sidebarFiles.some((f) => f.path === activeFilePath)) {
        setActiveFilePath(sidebarFiles[0].path);
      }
    }
  }, [sidebarFiles, activeFilePath]);

  // ── Mutations ──
  const addLabelMutation = useMutation({
    mutationFn: ({ version, label }: { version: number; label: string }) =>
      pagesService.history.labelProjectVersion(
        effectiveProjectId,
        version,
        label,
        pageScopeOpts,
      ),
    onSuccess: () => {
      refetchVersions();
    },
    onError: (err: unknown, vars) => {
      toast.error(`Failed to add label: ${(err as Error)?.message || 'Unknown error'}`, { id: `history-label-${vars.version}` });
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      pagesService.history.deleteProjectLabel(
        effectiveProjectId,
        labelId,
        pageScopeOpts,
      ),
    onSuccess: () => {
      refetchVersions();
    },
    onError: (err: unknown, labelId) => {
      toast.error(`Failed to remove label: ${(err as Error)?.message || 'Unknown error'}`, { id: `history-label-${labelId}` });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: number) => {
      for (const m of lruDocumentCache.getAllModels()) {
        sessionCoordinator.cancelPendingAutoSave(m.fileId);
      }
      return await pagesService.history.restoreProjectVersion(
        effectiveProjectId,
        version,
        pageScopeOpts,
      );
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
      if (effectiveProjectId) {
        documentFacade.clearProjectCache(effectiveProjectId);
        void unsyncedEditsStore.clearByScope(effectiveProjectId);
      }
      clearAllOfflineMemory();
      lruDocumentCache.discardAll();
      useCompileStore.getState().clearAllDirty();
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success(`Restored project to v${restoredVersion}`, { id: 'history-restore' });
      setConfirmingRestore(false);
      handleClose();
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore project: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-restore' });
    },
  });

  const restoreSingleFileMutation = useMutation({
    mutationFn: async (versionOverride?: number) => {
      const restoreVersion =
        versionOverride ??
        (historyMode === 'single' ? selectedTargetVersion : selectedBaseVersion);
      if (!effectiveProjectId || !restoreVersion || !activeFilePath) {
        throw new Error('Missing project, version or file information');
      }

      const cachedMatch = lruDocumentCache.findByPath(activeFilePath);
      if (cachedMatch) {
        sessionCoordinator.cancelPendingAutoSave(cachedMatch.fileId);
      }

      const restored = await pagesService.history.restoreProjectVersionFile(
        effectiveProjectId,
        restoreVersion,
        activeFilePath,
        undefined,
        pageScopeOpts,
      );

      return {
        filePath: restored.path || activeFilePath,
        docId: restored.docId ?? undefined,
        baseVersion: restoreVersion,
        baseContent: restored.content ?? '',
        rev: restored.rev,
      };
    },
    onSuccess: ({ filePath, docId, baseVersion, baseContent, rev }) => {
      toast.success(`Restored ${filePath} from v${baseVersion}`, { id: `history-restore-${filePath}` });
      setConfirmingFileRestore(false);
      let updatedMountedEngine = false;
      if (docId) {
        sessionCoordinator.cancelPendingAutoSave(docId);
        evictYjsProviderByDocId(docId, { skipFlush: true });
        lruDocumentCache.clearServerRev(docId);
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(docId, rev);
        }
        lruDocumentCache.updateContent(docId, baseContent, false);
        lruDocumentCache.markClean(docId);
        useCompileStore.getState().clearDirty(docId);
        void unsyncedEditsStore.clear(docId);
        const engine = documentFacade.getEditorEngineForFile(docId);
        if (engine) {
          engine.setContent(baseContent);
          updatedMountedEngine = true;
        }
      }
      const cachedByPath = lruDocumentCache.findByPath(filePath);
      if (cachedByPath && cachedByPath.fileId !== docId) {
        sessionCoordinator.cancelPendingAutoSave(cachedByPath.fileId);
        evictYjsProviderByDocId(cachedByPath.fileId, { skipFlush: true });
        lruDocumentCache.clearServerRev(cachedByPath.fileId);
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(cachedByPath.fileId, rev);
        }
        lruDocumentCache.updateContent(cachedByPath.fileId, baseContent, false);
        lruDocumentCache.markClean(cachedByPath.fileId);
        useCompileStore.getState().clearDirty(cachedByPath.fileId);
        void unsyncedEditsStore.clear(cachedByPath.fileId);
      }
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      if (!updatedMountedEngine) {
        editorCommandBus.dispatch({
          type: 'document:content-updated',
          docId: docId || filePath,
          content: baseContent,
        });
      }
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore file: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-restore-file' });
    },
  });

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadVersionZip = async (versionOverride?: number) => {
    const targetVer = versionOverride ?? selectedTargetVersion;
    if (!effectiveProjectId || !targetVer || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const projectTitle = currentPageTitle || 'project';
      await exportVersionAsZip({
        projectId: effectiveProjectId,
        pageId: effectivePageId || undefined,
        version: targetVer,
        projectTitle,
      });
    } catch (err: unknown) {
      toast.error(`Failed to download Version ZIP: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-download-zip' });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleSelectVersion = (version: number) => {
    setSelectedTargetVersion(version);
    const foundIdx = versions.findIndex((v) => v.version === version);
    if (foundIdx >= 0 && foundIdx < versions.length - 1) {
      setSelectedBaseVersion(versions[foundIdx + 1].version);
    } else {
      setSelectedBaseVersion(Math.max(1, version - 1));
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Project Version History"
      className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-background overflow-hidden select-none font-sans"
    >
      {/* ── Top Header Bar ── */}
      <header className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-background shrink-0 select-none gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer -ml-1 h-8"
            title="Return to the manuscript editor"
          >
            <ArrowLeft className="size-4" />
            <span>Back to editor</span>
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Project History</h2>
            {historyMode === 'single' && selectedTargetVersion != null ? (
              <Badge variant="outline" className="text-[11px] font-mono py-0 h-5">
                v{selectedTargetVersion}
              </Badge>
            ) : historyMode === 'compare' && selectedTargetVersion != null && selectedBaseVersion != null ? (
              <Badge variant="outline" className="text-[11px] font-mono py-0 h-5">
                v{selectedBaseVersion} → v{selectedTargetVersion}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Right: Compare View Switcher only */}
        {historyMode === 'compare' && (
          <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-muted-foreground shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                viewMode === 'unified'
                  ? 'bg-muted text-foreground'
                  : 'hover:text-foreground'
              )}
              title="Unified Diff View"
            >
              <AlignJustify className="size-3.5" />
              <span className="hidden md:inline">Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                viewMode === 'split'
                  ? 'bg-muted text-foreground'
                  : 'hover:text-foreground'
              )}
              title="Side-by-Side Split Diff View"
            >
              <Columns2 className="size-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
          </div>
        )}
      </header>

      {/* ── Project Restore Confirmation Bar ── */}
      {confirmingRestore && selectedTargetVersion != null && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs shrink-0">
          <div className="flex items-center gap-2 text-foreground">
            <RotateCcw className="size-3.5 text-destructive shrink-0" />
            <span>
              Restore project to{' '}
              <span className="font-mono font-semibold">v{selectedTargetVersion}</span>?
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(selectedTargetVersion)}
            >
              {restoreMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              <span>Confirm restore</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs cursor-pointer"
              onClick={() => setConfirmingRestore(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Main Body (3 Columns — Overleaf 1:1 Layout) ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Left Column: Snapshot / Changed Files Tree */}
        <HistoryFileTreeSidebar
          mode={historyMode}
          files={sidebarFiles}
          activeFilePath={activeFilePath}
          onSelectFile={setActiveFilePath}
          isLoading={historyMode === 'single' ? isLoadingTargetSnapshot : isLoadingDiff}
          versionLabel={
            historyMode === 'single' && selectedTargetVersion != null
              ? `v${selectedTargetVersion}`
              : historyMode === 'compare' &&
                  selectedBaseVersion != null &&
                  selectedTargetVersion != null
                ? `v${selectedBaseVersion}→v${selectedTargetVersion}`
                : undefined
          }
        />

        {/* Center Column: Single Version Read-Only Viewer OR Diff Viewer */}
        {historyMode === 'single' ? (
          <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
            {isLoadingTargetSnapshot ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span>Loading snapshot v{selectedTargetVersion}...</span>
              </div>
            ) : !activeFilePath || !findSnapshotFileEntry(targetSnapshot?.files, activeFilePath) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-6 text-center">
                <FileText className="size-6 mb-2 opacity-40" strokeWidth={1.5} />
                <p className="font-medium text-foreground">Select a file to inspect</p>
                <p className="text-[11px] mt-0.5">
                  Choose any file from the left tree to view its content at v{selectedTargetVersion}.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border text-xs shrink-0 select-none gap-2 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <span className="font-mono font-semibold text-foreground truncate">
                      {activeFilePath}
                    </span>
                    {selectedTargetVersion != null && (
                      <Badge variant="outline" className="text-10 font-mono h-4 px-1.5">
                        v{selectedTargetVersion}
                      </Badge>
                    )}
                  </div>

                  {selectedTargetVersion != null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant={confirmingFileRestore ? 'destructive' : 'secondary'}
                        size="sm"
                        className="h-7 min-h-[28px] px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
                        disabled={restoreSingleFileMutation.isPending}
                        onClick={() => {
                          if (confirmingFileRestore) {
                            restoreSingleFileMutation.mutate(selectedTargetVersion);
                          } else {
                            setConfirmingFileRestore(true);
                          }
                        }}
                      >
                        {restoreSingleFileMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3" />
                        )}
                        <span>
                          {confirmingFileRestore
                            ? `Confirm restore ${activeFilePath.split('/').pop() || 'file'} to v${selectedTargetVersion}`
                            : 'Restore this file'}
                        </span>
                      </Button>
                      {confirmingFileRestore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs cursor-pointer"
                          onClick={() => setConfirmingFileRestore(false)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-auto bg-background">
                  <table className="w-full border-collapse font-mono text-xs leading-5">
                    <tbody>
                      {extractSnapshotFileContent(
                        findSnapshotFileEntry(targetSnapshot?.files, activeFilePath),
                      )
                        .split('\n')
                        .map((lineText, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="w-12 select-none text-right pr-3 pl-2 py-0.5 text-muted-foreground/60 border-r border-border/50 align-top">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-0.5 whitespace-pre-wrap break-words text-foreground">
                              {lineText || ' '}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </main>
        ) : (
          <DiffContentPane
            diffData={diffData}
            isLoadingDiff={isLoadingDiff}
            activeFilePath={activeFilePath}
            viewMode={viewMode}
            selectedBaseVersion={selectedBaseVersion}
            selectedTargetVersion={selectedTargetVersion}
            onRestoreSingleFile={() => restoreSingleFileMutation.mutate(undefined)}
            isRestoringSingleFile={restoreSingleFileMutation.isPending}
            confirmingFileRestore={confirmingFileRestore}
            setConfirmingFileRestore={setConfirmingFileRestore}
          />
        )}

        {/* Right Column: Timeline Versions Sidebar */}
        <VersionTimelineSidebar
          versions={versions}
          isLoadingVersions={isLoadingVersions}
          historyMode={historyMode}
          onHistoryModeChange={setHistoryMode}
          filter={filter}
          setFilter={setFilter}
          selectedTargetVersion={selectedTargetVersion}
          selectedBaseVersion={selectedBaseVersion}
          onSelectVersion={handleSelectVersion}
          onSelectBaseVersion={(v) => setSelectedBaseVersion(v)}
          onAddLabel={(version, label) => addLabelMutation.mutate({ version, label })}
          onDeleteLabel={(labelId) => deleteLabelMutation.mutate(labelId)}
          onDownloadVersion={(v) => void handleDownloadVersionZip(v)}
          onRestoreVersion={(v) => {
            if (v !== selectedTargetVersion) {
              skipNextRestoreResetRef.current = true;
              handleSelectVersion(v);
            }
            setConfirmingRestore(true);
          }}
          isAddingLabelLoading={addLabelMutation.isPending}
        />
      </div>
    </div>
  );
}

export default HistoryPage;

