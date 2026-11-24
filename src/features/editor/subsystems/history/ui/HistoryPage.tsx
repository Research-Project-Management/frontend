'use client';

/**
 * HistoryPage.tsx
 *
 * Canonical Project History & Visual Diff Comparison Page (Overleaf Parity).
 * Location: `features/editor/subsystems/history/ui/HistoryPage.tsx`
 *
 * Features:
 * - Version Timeline: View all revisions or labelled snapshots, search by note/label/author.
 * - Side-by-Side & Unified Diff: Powered by Myers diff tokenization.
 * - Label Management: Tag milestone snapshots with custom labels, delete labels.
 * - 1-Click Rollback / Restore: Safely revert project files to any historical version.
 * - Manual Snapshot Checkpoints: Create on-demand named snapshots of the project.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  RotateCcw,
  Plus,
  X,
  Columns2,
  AlignJustify,
  Loader2,
  Bookmark,
  Download,
  ArrowLeft,
  Copy,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import { pagesService, historyKeys } from '@/features/editor/sdk/pages.service';
import { exportVersionAsZip } from '@/features/editor/sdk/archive/archive-export';
import {
  clearYjsProviderPool,
  evictYjsProviderByDocId,
  flushYjsProviders,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [selectedTargetVersion, setSelectedTargetVersion] = useState<number | null>(
    initialVersion || null
  );
  const [selectedBaseVersion, setSelectedBaseVersion] = useState<number | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Snapshot creation dialog state
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState('');

  // Restore confirmation state
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [confirmingFileRestore, setConfirmingFileRestore] = useState(false);

  const prevSelectionRef = React.useRef({
    file: activeFilePath,
    base: selectedBaseVersion,
    target: selectedTargetVersion,
  });

  useEffect(() => {
    const prev = prevSelectionRef.current;
    if (
      (prev.file && prev.file !== activeFilePath) ||
      (prev.base !== null && prev.base !== selectedBaseVersion) ||
      (prev.target !== null && prev.target !== selectedTargetVersion)
    ) {
      setConfirmingFileRestore(false);
      setConfirmingRestore(false);
    }
    prevSelectionRef.current = {
      file: activeFilePath,
      base: selectedBaseVersion,
      target: selectedTargetVersion,
    };
  }, [activeFilePath, selectedBaseVersion, selectedTargetVersion]);

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

  // Query base snapshot for file restoration and copy in Compare mode
  const { data: baseSnapshot } = useQuery<ProjectSnapshotDetail | null>({
    queryKey: ['project-snapshot', effectiveProjectId, effectivePageId, selectedBaseVersion],
    queryFn: () =>
      selectedBaseVersion
        ? pagesService.history.getProjectSnapshot(
            effectiveProjectId,
            selectedBaseVersion,
            pageScopeOpts,
          )
        : null,
    enabled: canCompare && open,
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
    onSuccess: (_, vars) => {
      toast.success(`Attached label "${vars.label}" to v${vars.version}`, { id: `history-label-${vars.version}` });
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
    onSuccess: (_data, labelId) => {
      toast.success('Label removed', { id: `history-label-${labelId}` });
      refetchVersions();
    },
    onError: (err: unknown, labelId) => {
      toast.error(`Failed to remove label: ${(err as Error)?.message || 'Unknown error'}`, { id: `history-label-${labelId}` });
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (summary: string) => {
      const hasDirtyBeforeSnapshot =
        typeof sessionCoordinator.hasDirtyDocuments === 'function'
          ? sessionCoordinator.hasDirtyDocuments()
          : true;
      if (hasDirtyBeforeSnapshot) {
        if (effectiveProjectId) {
          flushYjsProviders(effectiveProjectId);
        }
        await sessionCoordinator.flushAllPending();
      }
      return await pagesService.history.createProjectSnapshot(
        effectiveProjectId,
        { summary, ...(effectivePageId ? { pageId: effectivePageId } : {}) },
        pageScopeOpts,
      );
    },
    onSuccess: (newVersion) => {
      if (!newVersion) return;
      toast.success(`Created milestone snapshot v${newVersion.version}`, { id: 'history-snapshot' });
      setIsCreatingSnapshot(false);
      setSnapshotSummary('');
      refetchVersions();
      setSelectedTargetVersion(newVersion.version);
    },
    onError: (err: unknown) => {
      toast.error(`Failed to create snapshot: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-snapshot' });
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
      toast.success(`Project successfully restored to v${restoredVersion}`, { id: 'history-restore' });
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
      toast.success(`File "${filePath}" restored from Version ${baseVersion}`, { id: `history-restore-${filePath}` });
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

  const copySnapshotFile = async (
    version: number | null,
    cachedSnapshot: ProjectSnapshotDetail | null | undefined,
  ) => {
    try {
      let snap = cachedSnapshot;
      if (!snap && effectiveProjectId && version) {
        snap = await pagesService.history.getProjectSnapshot(
          effectiveProjectId,
          version,
          pageScopeOpts,
        );
      }
      if (!snap || !activeFilePath || !version) return;
      const fileData = findSnapshotFileEntry(snap.files, activeFilePath);
      if (!fileData) {
        toast.error(`File ${activeFilePath} not found in Version ${version}`);
        return;
      }
      const content = extractSnapshotFileContent(fileData);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      }
      toast.success(`Copied v${version} of ${activeFilePath} to clipboard`, { id: 'history-copy-file' });
    } catch (err: unknown) {
      toast.error(`Failed to copy file: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-copy-file' });
    }
  };

  const handleCopyBaseFile = () => copySnapshotFile(selectedBaseVersion, baseSnapshot);
  const handleCopySingleFile = () => copySnapshotFile(selectedTargetVersion, targetSnapshot);

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadVersionZip = async (versionOverride?: number) => {
    const targetVer = versionOverride ?? selectedTargetVersion;
    if (!effectiveProjectId || !targetVer) return;
    setIsDownloadingZip(true);
    try {
      const projectTitle = currentPageTitle || 'project';
      await exportVersionAsZip({
        projectId: effectiveProjectId,
        pageId: effectivePageId || undefined,
        version: targetVer,
        projectTitle,
      });
      toast.success(`Successfully downloaded ZIP for Version ${targetVer}`, { id: 'history-download-zip' });
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
      {/* ── Top Header Bar (Overleaf Parity) ── */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-background shrink-0 select-none overflow-x-auto overflow-y-hidden scrollbar-none gap-3">
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
          <div className="flex items-center gap-2.5">
            <History className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-14 font-semibold text-foreground tracking-tight">Project History</h2>
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
              <p className="text-12 text-muted-foreground mt-0.5">
                {versions.length} total {versions.length === 1 ? 'version' : 'versions'} recorded
              </p>
            </div>
          </div>
        </div>

        {/* Center: Diff Stats (Compare Mode only) */}
        {historyMode === 'compare' && diffData && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-medium text-success bg-success/10 rounded-sm border border-success/20">
              {`+${diffData.totalAdditions}`}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-medium text-destructive bg-destructive/10 rounded-sm border border-destructive/20">
              {`-${diffData.totalDeletions}`}
            </span>
            <span className="text-xs text-muted-foreground">
              ({diffData.filesChanged} {diffData.filesChanged === 1 ? 'file' : 'files'} changed)
            </span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Switcher (Compare Mode only) */}
          {historyMode === 'compare' && (
            <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-muted-foreground">
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-[\'\']',
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
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-[\'\']',
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

          {/* Create Snapshot Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreatingSnapshot(true)}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Snapshot</span>
          </Button>

          {/* Download this version as ZIP (Overleaf Parity) */}
          {selectedTargetVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadVersionZip()}
              disabled={isDownloadingZip}
              className="h-8 gap-1.5 text-xs cursor-pointer"
              title={`Download Version ${selectedTargetVersion} as ZIP archive`}
            >
              {isDownloadingZip ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span className="hidden sm:inline">Download ZIP</span>
            </Button>
          )}

          {/* Restore this version */}
          {selectedTargetVersion && (
            <Button
              variant={confirmingRestore ? 'destructive' : 'default'}
              size="sm"
              onClick={() => {
                if (confirmingRestore) {
                  restoreMutation.mutate(selectedTargetVersion);
                } else {
                  setConfirmingRestore(true);
                }
              }}
              disabled={restoreMutation.isPending}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              {restoreMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              <span>
                {confirmingRestore
                  ? `Confirm restore to v${selectedTargetVersion}`
                  : 'Restore this version'}
              </span>
            </Button>
          )}

          {confirmingRestore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRestore(false)}
              className="h-8 px-2 text-xs"
            >
              Cancel
            </Button>
          )}

          <div className="h-4 w-px bg-border/60 mx-1" />

          <button
            type="button"
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* ── Snapshot Creation Inline Banner ── */}
      {isCreatingSnapshot && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border shrink-0 animate-in fade-in duration-150">
          <Bookmark className="size-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            New Milestone Snapshot:
          </span>
          <Input
            value={snapshotSummary}
            onChange={(e) => setSnapshotSummary(e.target.value)}
            placeholder="e.g. Completed Section 3 methodology draft..."
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && snapshotSummary.trim()) {
                createSnapshotMutation.mutate(snapshotSummary.trim());
              } else if (e.key === 'Escape') {
                setIsCreatingSnapshot(false);
              }
            }}
          />
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={!snapshotSummary.trim() || createSnapshotMutation.isPending}
            onClick={() => createSnapshotMutation.mutate(snapshotSummary.trim())}
          >
            {createSnapshotMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              'Save Snapshot'
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setIsCreatingSnapshot(false)}
          >
            Cancel
          </Button>
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 min-h-[28px] px-2 text-xs gap-1 cursor-pointer"
                      onClick={handleCopySingleFile}
                    >
                      <Copy className="size-3" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>

                    {selectedTargetVersion != null && (
                      <div className="flex items-center gap-1">
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
                              : 'Restore this version'}
                          </span>
                        </Button>
                        {confirmingFileRestore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmingFileRestore(false)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
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
            setActiveFilePath={setActiveFilePath}
            viewMode={viewMode}
            selectedBaseVersion={selectedBaseVersion}
            selectedTargetVersion={selectedTargetVersion}
            onCopyBaseFile={handleCopyBaseFile}
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
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedTargetVersion={selectedTargetVersion}
          selectedBaseVersion={selectedBaseVersion}
          onSelectVersion={handleSelectVersion}
          onSelectBaseVersion={(v) => setSelectedBaseVersion(v)}
          onAddLabel={(version, label) => addLabelMutation.mutate({ version, label })}
          onDeleteLabel={(labelId) => deleteLabelMutation.mutate(labelId)}
          onDownloadVersion={(v) => void handleDownloadVersionZip(v)}
          onRestoreVersion={(v) => {
            handleSelectVersion(v);
            setConfirmingRestore(true);
          }}
          isAddingLabelLoading={addLabelMutation.isPending}
        />
      </div>
    </div>
  );
}

export default HistoryPage;

