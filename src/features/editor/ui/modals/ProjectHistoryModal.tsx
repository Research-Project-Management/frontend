'use client';

/**
 * ProjectHistoryModal.tsx
 *
 * Canonical Project History & Visual Diff Comparison Modal (Overleaf Parity).
 * Location: `features/editor/ui/modals/ProjectHistoryModal.tsx`
 *
 * Features:
 * - Version Timeline: View all revisions or labelled snapshots, search by note/label/author.
 * - Side-by-Side & Unified Diff: Powered by @codemirror/merge and Myers diff tokenization.
 * - Label Management: Tag milestone snapshots with custom labels, delete labels.
 * - 1-Click Rollback / Restore: Safely revert project files to any historical version.
 * - Manual Snapshot Checkpoints: Create on-demand named snapshots of the project.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  RotateCcw,
  Plus,
  X,
  Columns2,
  AlignJustify,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import { historyService, historyKeys } from '../../coordinators/services/history.service';
import { manuscriptService } from '../../coordinators/services/manuscript.service';
import { editorCommandBus } from '../../coordinators/command-bus';
import { usePageStore } from '../../store';
import type {
  ProjectDiffResponse,
  ProjectSnapshotDetail,
} from '../../domain/types/history.types';
import {
  SideBySideDiffViewer,
  UnifiedDiffViewer,
  alignHunkForSplitView,
  type AlignedSplitRow,
  VersionTimelineSidebar,
  DiffContentPane,
} from './project-history';

export {
  SideBySideDiffViewer,
  UnifiedDiffViewer,
  alignHunkForSplitView,
  type AlignedSplitRow,
};

export interface ProjectHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  initialVersion?: number;
}

export default function ProjectHistoryModal({
  open,
  onOpenChange,
  projectId: propProjectId,
  initialVersion,
}: ProjectHistoryModalProps) {
  const queryClient = useQueryClient();
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);

  const effectiveProjectId =
    propProjectId ||
    params?.projectId ||
    (typeof (currentPage as any)?.projectId === 'string'
      ? (currentPage as any).projectId
      : (currentPage as any)?.projectId?.id) ||
    '';

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

  useEffect(() => {
    setConfirmingFileRestore(false);
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
      toast.success(`Attached label "${vars.label}" to v${vars.version}`);
      refetchVersions();
    },
    onError: (err: any) => {
      toast.error(`Failed to add label: ${err?.message || 'Unknown error'}`);
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      historyService.deleteProjectLabel(effectiveProjectId, labelId),
    onSuccess: () => {
      toast.success('Label removed');
      refetchVersions();
    },
    onError: (err: any) => {
      toast.error(`Failed to remove label: ${err?.message || 'Unknown error'}`);
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (summary: string) =>
      historyService.createProjectSnapshot(effectiveProjectId, summary),
    onSuccess: (newVersion) => {
      toast.success(`Created milestone snapshot v${newVersion.version}`);
      setIsCreatingSnapshot(false);
      setSnapshotSummary('');
      refetchVersions();
      setSelectedTargetVersion(newVersion.version);
    },
    onError: (err: any) => {
      toast.error(`Failed to create snapshot: ${err?.message || 'Unknown error'}`);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      historyService.restoreProjectVersion(effectiveProjectId, version),
    onSuccess: (_, restoredVersion) => {
      toast.success(`Project successfully restored to v${restoredVersion}`);
      setConfirmingRestore(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: historyKeys.versions(effectiveProjectId) });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    onError: (err: any) => {
      toast.error(`Failed to restore project: ${err?.message || 'Unknown error'}`);
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
        snap = await historyService.getProjectSnapshot(effectiveProjectId, selectedBaseVersion);
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
      let docId = typeof fileData === 'object' && fileData !== null ? (fileData as any).docId : undefined;
      if (!docId) {
        if (
          currentPage &&
          (currentPage.title === activeFilePath ||
            (currentPage as any).name === activeFilePath ||
            currentPage.id === activeFilePath)
        ) {
          docId = currentPage.id;
        }
      }
      if (!docId) {
        const hierarchy = usePageStore.getState().fileHierarchy;
        if (hierarchy && Array.isArray(hierarchy)) {
          const findNode = (nodes: any[]): any => {
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

      // 3. Update document content if docId found
      if (docId) {
        await manuscriptService.docs.updateContent(docId, baseContent);
      }

      // 4. Capture automated non-destructive checkpoint
      await historyService.createProjectSnapshot(effectiveProjectId, {
        summary: `Restored ${activeFilePath} from Version ${selectedBaseVersion}`,
        isAutomatic: false,
      });

      return { filePath: activeFilePath, baseVersion: selectedBaseVersion };
    },
    onSuccess: ({ filePath, baseVersion }) => {
      toast.success(`File "${filePath}" restored from Version ${baseVersion}`);
      setConfirmingFileRestore(false);
      queryClient.invalidateQueries({ queryKey: historyKeys.versions(effectiveProjectId) });
      queryClient.invalidateQueries({ queryKey: ['project-history-diff'] });
      queryClient.invalidateQueries({ queryKey: ['project-snapshot'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    },
    onError: (err: any) => {
      toast.error(`Failed to restore file: ${err?.message || 'Unknown error'}`);
    },
  });

  const handleCopyBaseFile = async () => {
    try {
      let snap = baseSnapshot;
      if (!snap && effectiveProjectId && selectedBaseVersion) {
        snap = await historyService.getProjectSnapshot(effectiveProjectId, selectedBaseVersion);
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
      toast.success(`Copied v${selectedBaseVersion} of ${activeFilePath} to clipboard`);
    } catch (err: any) {
      toast.error(`Failed to copy file: ${err?.message || 'Unknown error'}`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[88vh] max-h-[950px] flex flex-col p-0 gap-0 overflow-hidden bg-background border rounded-xl shadow-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Project Version History</DialogTitle>
        <DialogDescription className="sr-only">
          View, compare, label and restore historical snapshots of this manuscript project.
        </DialogDescription>

        {/* ── Top Header Bar ── */}
        <header className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
              <History className="size-4 shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Project History</h2>
                {selectedTargetVersion && selectedBaseVersion && (
                  <Badge variant="outline" className="text-[11px] font-mono py-0 h-5">
                    v{selectedBaseVersion} → v{selectedTargetVersion}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {versions.length} total {versions.length === 1 ? 'version' : 'versions'} recorded
              </p>
            </div>
          </div>

          {/* Center: Diff Stats */}
          {diffData && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                {`+${diffData.totalAdditions}`}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded-full border border-rose-500/20">
                {`-${diffData.totalDeletions}`}
              </span>
              <span className="text-xs text-muted-foreground">
                ({diffData.filesChanged} {diffData.filesChanged === 1 ? 'file' : 'files'} changed)
              </span>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border bg-background p-0.5 text-muted-foreground">
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
                  viewMode === 'unified'
                    ? 'bg-muted text-foreground shadow-xs font-semibold'
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
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
                  viewMode === 'split'
                    ? 'bg-muted text-foreground shadow-xs font-semibold'
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
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* ── Snapshot Creation Inline Banner ── */}
        {isCreatingSnapshot && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b shrink-0 animate-in fade-in duration-150">
            <Sparkles className="size-4 text-primary shrink-0" />
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

        {/* ── Main Modal Body (2 Columns) ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
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
      </DialogContent>
    </Dialog>
  );
}
