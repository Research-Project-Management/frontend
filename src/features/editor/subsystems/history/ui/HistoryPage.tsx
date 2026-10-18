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
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import { manuscriptService, historyService, historyKeys } from '@/features/editor/sdk/manuscript.service';
import { exportVersionAsZip } from '@/features/editor/sdk/archive/archive-export';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';
import { editorCommandBus } from '@/features/editor/core';
import { usePageStore } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type {
  ProjectDiffResponse,
  ProjectSnapshotDetail,
} from '@/features/editor/domain/types/history.types';
import {
  SideBySideDiffViewer,
  alignHunkForSplitView,
  type AlignedSplitRow,
} from './SideBySideDiffViewer';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';
import { VersionTimelineSidebar } from './VersionTimelineSidebar';
import { DiffContentPane } from './DiffContentPane';

export {
  SideBySideDiffViewer,
  UnifiedDiffViewer,
  alignHunkForSplitView,
  type AlignedSplitRow,
};

export interface HistoryPageProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  projectId?: string;
  pageId?: string;
  initialVersion?: number;
}

export type ProjectHistoryModalProps = HistoryPageProps;

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
  const currentPage = usePageStore((s) => s.currentPage);

  const effectivePageId = propPageId || params?.pageId || currentPage?.id || '';
  const effectiveProjectId =
    propProjectId ||
    params?.projectId ||
    extractProjectId(currentPage) ||
    effectivePageId ||
    '';

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    if (onOpenChange) {
      onOpenChange(false);
      return;
    }
    if (params?.projectId && effectivePageId) {
      router.push(`/projects/${params.projectId}/pages/${effectivePageId}`);
    } else if (effectivePageId) {
      router.push(`/pages/${effectivePageId}`);
    } else if (effectiveProjectId) {
      router.push(`/projects/${effectiveProjectId}/pages`);
    } else {
      router.back();
    }
  }, [onClose, onOpenChange, params?.projectId, effectivePageId, effectiveProjectId, router]);

  // UI State
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
    queryKey: historyKeys.versions(effectiveProjectId),
    queryFn: () => historyService.getProjectVersions(effectiveProjectId),
    enabled: !!effectiveProjectId && open,
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
      selectedBaseVersion,
      selectedTargetVersion,
    ],
    queryFn: () =>
      historyService.compareProjectVersions(
        effectiveProjectId,
        selectedBaseVersion!,
        selectedTargetVersion!
      ),
    enabled: canCompare && open,
  });

  // Query snapshots for file restoration and diff viewer
  const { data: baseSnapshot } = useQuery<ProjectSnapshotDetail | null>({
    queryKey: ['project-snapshot', effectiveProjectId, selectedBaseVersion],
    queryFn: () =>
      selectedBaseVersion
        ? historyService.getProjectSnapshot(effectiveProjectId, selectedBaseVersion)
        : null,
    enabled: canCompare && open,
  });

  const { data: targetSnapshot } = useQuery<ProjectSnapshotDetail | null>({
    queryKey: ['project-snapshot', effectiveProjectId, selectedTargetVersion],
    queryFn: () =>
      selectedTargetVersion
        ? historyService.getProjectSnapshot(effectiveProjectId, selectedTargetVersion)
        : null,
    enabled: !!selectedTargetVersion && open,
  });

  // Automatically select first file when diff loads
  useEffect(() => {
    if (diffData?.files && diffData.files.length > 0) {
      if (!activeFilePath || !diffData.files.some((f) => f.path === activeFilePath)) {
        setActiveFilePath(diffData.files[0].path);
      }
    }
  }, [diffData, activeFilePath]);

  // ── Mutations ──
  const addLabelMutation = useMutation({
    mutationFn: ({ version, label }: { version: number; label: string }) =>
      historyService.labelProjectVersion(effectiveProjectId, version, label),
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
      historyService.deleteProjectLabel(effectiveProjectId, labelId),
    onSuccess: (_data, labelId) => {
      toast.success('Label removed', { id: `history-label-${labelId}` });
      refetchVersions();
    },
    onError: (err: unknown, labelId) => {
      toast.error(`Failed to remove label: ${(err as Error)?.message || 'Unknown error'}`, { id: `history-label-${labelId}` });
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (summary: string) =>
      historyService.createProjectSnapshot(effectiveProjectId, summary),
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
    mutationFn: (version: number) =>
      historyService.restoreProjectVersion(effectiveProjectId, version),
    onSuccess: (_, restoredVersion) => {
      toast.success(`Project successfully restored to v${restoredVersion}`, { id: 'history-restore' });
      setConfirmingRestore(false);
      handleClose();
      lruDocumentCache.clearAll();
      queryClient.invalidateQueries({ queryKey: historyKeys.versions(effectiveProjectId) });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore project: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-restore' });
    },
  });

  const restoreSingleFileMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveProjectId || !selectedBaseVersion || !activeFilePath) {
        throw new Error('Missing project, version or file information');
      }

      // 1. Fetch snapshot of base version if not already cached
      let snap = baseSnapshot;
      if (!snap) {
        snap = await manuscriptService.history.getProjectSnapshot(effectiveProjectId, selectedBaseVersion);
      }
      if (!snap || !snap.files) {
        throw new Error(`Snapshot for Version ${selectedBaseVersion} not found`);
      }

      const fileData =
        snap.files[activeFilePath] ||
        snap.files[`/${activeFilePath}`] ||
        snap.files[activeFilePath.replace(/^\//, '')];

      if (!fileData) {
        throw new Error(`File ${activeFilePath} not found in Version ${selectedBaseVersion}`);
      }

      const baseContent =
        typeof fileData === 'string'
          ? fileData
          : fileData.content ?? (fileData.lines ? fileData.lines.join('\n') : '');

      // 2. Resolve document ID for active file
      let docId = typeof fileData === 'object' && fileData !== null ? (fileData as { docId?: string }).docId : undefined;
      if (!docId) {
        if (
          currentPage &&
          (currentPage.title === activeFilePath ||
            (currentPage as { name?: string }).name === activeFilePath ||
            currentPage.id === activeFilePath)
        ) {
          docId = currentPage.id;
        }
      }
      if (!docId) {
        const hierarchy = usePageStore.getState().fileHierarchy;
        if (hierarchy && Array.isArray(hierarchy)) {
          const findNode = (nodes: NodeTreeItem[]): NodeTreeItem | null => {
            for (const node of nodes) {
              if (
                node.title === activeFilePath ||
                node.slug === activeFilePath ||
                node.title === activeFilePath.split('/').pop()
              ) {
                return node;
              }
              if (node.children?.length) {
                const found = findNode(node.children);
                if (found) return found;
              }
            }
            return null;
          };
          const matched = findNode(hierarchy);
          if (matched?.id) {
            docId = matched.id;
          }
        }
      }
      if (!docId) {
        const cachedByPath = lruDocumentCache.findByPath(activeFilePath);
        if (cachedByPath?.fileId) {
          docId = cachedByPath.fileId;
        }
      }

      // 3. Update document content if docId found, or create new file if it was deleted
      if (docId) {
        await manuscriptService.docs.updateContent(docId, baseContent);
      } else {
        const created = await manuscriptService.docs.create({
          projectId: effectiveProjectId,
          title: activeFilePath.replace(/^\//, ''),
          content: baseContent,
        });
        if (created?.id) {
          docId = created.id;
        }
      }

      // 4. Capture automated non-destructive checkpoint
      await manuscriptService.history.createProjectSnapshot(effectiveProjectId, {
        summary: `Restored ${activeFilePath} from Version ${selectedBaseVersion}`,
        isAutomatic: false,
      });

      return { filePath: activeFilePath, docId, baseVersion: selectedBaseVersion, baseContent };
    },
    onSuccess: ({ filePath, docId, baseVersion, baseContent }) => {
      toast.success(`File "${filePath}" restored from Version ${baseVersion}`, { id: `history-restore-${filePath}` });
      setConfirmingFileRestore(false);
      if (docId) {
        lruDocumentCache.updateContent(docId, baseContent, false);
      }
      const cachedByPath = lruDocumentCache.findByPath(filePath);
      if (cachedByPath && cachedByPath.fileId !== docId) {
        lruDocumentCache.updateContent(cachedByPath.fileId, baseContent, false);
      }
      queryClient.invalidateQueries({ queryKey: historyKeys.versions(effectiveProjectId) });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
      editorCommandBus.dispatch({
        type: 'document:content-updated',
        docId: docId || filePath,
        content: baseContent,
      });
      const activeId = usePageStore.getState().activePageId || usePageStore.getState().activeFilePage?.id;
      if (docId && activeId === docId) {
        editorCommandBus.dispatch({
          type: 'editor:set-content',
          content: baseContent,
        });
      }
    },
    onError: (err: unknown) => {
      toast.error(`Failed to restore file: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-restore-file' });
    },
  });

  const handleCopyBaseFile = async () => {
    try {
      let snap = baseSnapshot;
      if (!snap && effectiveProjectId && selectedBaseVersion) {
        snap = await manuscriptService.history.getProjectSnapshot(effectiveProjectId, selectedBaseVersion);
      }
      if (!snap || !activeFilePath) return;
      const fileData =
        snap.files[activeFilePath] ||
        snap.files[`/${activeFilePath}`] ||
        snap.files[activeFilePath.replace(/^\//, '')];
      if (!fileData) {
        toast.error(`File ${activeFilePath} not found in Version ${selectedBaseVersion}`);
        return;
      }
      const content =
        typeof fileData === 'string'
          ? fileData
          : fileData.content ?? (fileData.lines ? fileData.lines.join('\n') : '');
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      }
      toast.success(`Copied v${selectedBaseVersion} of ${activeFilePath} to clipboard`, { id: 'history-copy-file' });
    } catch (err: unknown) {
      toast.error(`Failed to copy file: ${(err as Error)?.message || 'Unknown error'}`, { id: 'history-copy-file' });
    }
  };

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadVersionZip = async () => {
    if (!effectiveProjectId || !selectedTargetVersion) return;
    setIsDownloadingZip(true);
    try {
      const projectTitle = currentPage?.title || 'project';
      await exportVersionAsZip({
        projectId: effectiveProjectId,
        version: selectedTargetVersion,
        projectTitle,
      });
      toast.success(`Successfully downloaded ZIP for Version ${selectedTargetVersion}`, { id: 'history-download-zip' });
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
                {selectedTargetVersion != null && selectedBaseVersion != null ? (
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

        {/* Center: Diff Stats */}
        {diffData && (
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
          {/* View Mode Switcher */}
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
              onClick={handleDownloadVersionZip}
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

      {/* ── Main Body (2 Columns) ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Left Column: Timeline Versions Sidebar */}
        <VersionTimelineSidebar
          versions={versions}
          isLoadingVersions={isLoadingVersions}
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
          isAddingLabelLoading={addLabelMutation.isPending}
        />

        {/* Right Column: File Diffs & Content Viewer */}
        <DiffContentPane
          diffData={diffData}
          isLoadingDiff={isLoadingDiff}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
          viewMode={viewMode}
          selectedBaseVersion={selectedBaseVersion}
          selectedTargetVersion={selectedTargetVersion}
          onCopyBaseFile={handleCopyBaseFile}
          onRestoreSingleFile={() => restoreSingleFileMutation.mutate()}
          isRestoringSingleFile={restoreSingleFileMutation.isPending}
          confirmingFileRestore={confirmingFileRestore}
          setConfirmingFileRestore={setConfirmingFileRestore}
        />
      </div>
    </div>
  );
}

export default HistoryPage;
export const ProjectHistoryPage = HistoryPage;
export const ProjectHistoryView = HistoryPage;
export const ProjectHistoryModal = HistoryPage;
