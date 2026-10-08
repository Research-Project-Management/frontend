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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History,
  RotateCcw,
  Tag,
  Plus,
  Check,
  X,
  Search,
  FileText,
  Eye,
  Columns2,
  AlignJustify,
  Loader2,
  AlertCircle,
  Clock,
  Trash2,
  Sparkles,
  Copy,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

import { historyService, historyKeys } from '../../coordinators/services/history.service';
import { manuscriptService } from '../../coordinators/services/manuscript.service';
import { filesQuery } from '../hooks/use-core';
import { editorCommandBus } from '../../coordinators/command-bus';
import { usePageStore } from '../../store';
import type {
  ProjectVersionListItem,
  ProjectDiffResponse,
  ProjectFileDiff,
  DiffHunk,
  DiffLine,
  ProjectSnapshotDetail,
} from '../../domain/types/history.types';
import {
  formatVersionTime,
  MergeDiffEditor,
  SideBySideDiffViewer,
  UnifiedDiffViewer,
  alignHunkForSplitView,
  type AlignedSplitRow,
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

// ─── Main Project History Modal ─────────────────────────────────────────────

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
  const [selectedTargetVersion, setSelectedTargetVersion] = useState<number | null>(initialVersion || null);
  const [selectedBaseVersion, setSelectedBaseVersion] = useState<number | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Snapshot creation dialog state
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState('');

  // Label attachment state
  const [labelingVersion, setLabelingVersion] = useState<number | null>(null);
  const [newLabelText, setNewLabelText] = useState('');

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
    queryKey: ['project-history-diff', effectiveProjectId, selectedBaseVersion, selectedTargetVersion],
    queryFn: () =>
      historyService.compareProjectVersions(
        effectiveProjectId,
        selectedBaseVersion!,
        selectedTargetVersion!,
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

  // Filtered versions list
  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (filter === 'labelled' && (!v.labels || v.labels.length === 0)) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchSummary = v.summary?.toLowerCase().includes(q);
      const matchLabel = v.labels?.some((l) => l.label.toLowerCase().includes(q));
      const matchVer = `v${v.version}`.includes(q) || `${v.version}` === q;
      return matchSummary || matchLabel || matchVer;
    });
  }, [versions, filter, searchQuery]);

  // Selected file diff
  const activeFileDiff = useMemo(() => {
    if (!diffData?.files || !activeFilePath) return null;
    return diffData.files.find((f) => f.path === activeFilePath) || diffData.files[0] || null;
  }, [diffData, activeFilePath]);

  // Content for MergeView
  const { baseFileContent, targetFileContent } = useMemo(() => {
    if (!activeFilePath || !baseSnapshot || !targetSnapshot) {
      return { baseFileContent: '', targetFileContent: '' };
    }
    const extractContent = (snap: ProjectSnapshotDetail) => {
      const f = snap.files[activeFilePath];
      if (!f) return '';
      if (typeof f === 'string') return f;
      return f.content || f.lines?.join('\n') || '';
    };

    return {
      baseFileContent: extractContent(baseSnapshot),
      targetFileContent: extractContent(targetSnapshot),
    };
  }, [activeFilePath, baseSnapshot, targetSnapshot]);

  // ── Mutations ──

  // Restore version
  const restoreMutation = useMutation({
    mutationFn: (targetVer: number) =>
      historyService.restoreProjectVersion(effectiveProjectId, targetVer),
    onSuccess: (data, targetVer) => {
      toast.success(`Project successfully restored to Version ${targetVer}`);
      setConfirmingRestore(false);
      queryClient.invalidateQueries({ queryKey: historyKeys.versions(effectiveProjectId) });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(`Failed to restore version: ${err?.message || 'Unknown error'}`);
    },
  });

  // Create Snapshot
  const createSnapshotMutation = useMutation({
    mutationFn: (summary: string) =>
      historyService.createProjectSnapshot(effectiveProjectId, summary),
    onSuccess: () => {
      toast.success('Snapshot created successfully');
      setIsCreatingSnapshot(false);
      setSnapshotSummary('');
      refetchVersions();
    },
    onError: (err: any) => {
      toast.error(`Failed to create snapshot: ${err?.message || 'Unknown error'}`);
    },
  });

  // Add Label
  const addLabelMutation = useMutation({
    mutationFn: ({ version, label }: { version: number; label: string }) =>
      historyService.labelProjectVersion(effectiveProjectId, version, label),
    onSuccess: () => {
      toast.success('Label added');
      setLabelingVersion(null);
      setNewLabelText('');
      refetchVersions();
    },
    onError: (err: any) => {
      toast.error(`Failed to add label: ${err?.message || 'Unknown error'}`);
    },
  });

  // Delete Label
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

  // 1-Click Restore Single File
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
    // If clicking a version, set base to the next older version
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
          {/* ── Left Column: Timeline Versions Sidebar ── */}
          <aside className="w-80 sm:w-88 border-r flex flex-col bg-muted/15 shrink-0 overflow-hidden">
            {/* Filter and Search Bar */}
            <div className="p-3 border-b space-y-2 shrink-0 bg-background/50">
              <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-muted/40 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={cn(
                    'flex-1 py-1 text-center rounded-md transition-colors cursor-pointer',
                    filter === 'all'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All Revisions ({versions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('labelled')}
                  className={cn(
                    'flex-1 py-1 text-center rounded-md transition-colors cursor-pointer',
                    filter === 'labelled'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Labelled ({versions.filter((v) => v.labels?.length > 0).length})
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter versions or labels..."
                  className="h-7 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Versions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y-0">
              {isLoadingVersions ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span>Loading version history...</span>
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs text-center px-4">
                  <Clock className="size-6 mb-2 opacity-40" />
                  <p className="font-medium text-foreground">No versions found</p>
                  <p className="text-[11px] mt-0.5">
                    {filter === 'labelled'
                      ? 'No snapshots have been labelled yet.'
                      : 'Revisions will appear automatically as you edit.'}
                  </p>
                </div>
              ) : (
                filteredVersions.map((v) => {
                  const isTarget = selectedTargetVersion === v.version;
                  const isBase = selectedBaseVersion === v.version;
                  const isAddingLabel = labelingVersion === v.version;

                  return (
                    <div
                      key={v.id || v.version}
                      onClick={() => handleSelectVersion(v.version)}
                      className={cn(
                        'group relative flex flex-col p-2.5 rounded-lg border transition-all cursor-pointer text-left',
                        isTarget
                          ? 'bg-primary/10 border-primary/40 shadow-xs'
                          : isBase
                            ? 'bg-muted/70 border-muted-foreground/30'
                            : 'bg-card hover:bg-muted/40 border-border/70'
                      )}
                    >
                      {/* Top Row: Version Badge, Save Type, Time */}
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold',
                              isTarget
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            )}
                          >
                            v{v.version}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {v.isAutomatic ? 'Auto-save' : 'Snapshot'}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatVersionTime(v.createdAt)}
                        </span>
                      </div>

                      {/* Summary / Commit Message */}
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                        {v.summary || (v.isAutomatic ? 'Automated synchronization checkpoint' : 'Snapshot')}
                      </p>

                      {/* Labels Chips */}
                      {v.labels && v.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {v.labels.map((lbl) => (
                            <span
                              key={lbl.id || lbl.label}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-md"
                            >
                              <Tag className="size-2.5" />
                              <span>{lbl.label}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLabelMutation.mutate(lbl.id);
                                }}
                                className="hover:text-destructive transition-colors ml-0.5"
                                title="Remove label"
                              >
                                <X className="size-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Inline Add Label Box */}
                      {isAddingLabel ? (
                        <div
                          className="flex items-center gap-1 mt-2 pt-2 border-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={newLabelText}
                            onChange={(e) => setNewLabelText(e.target.value)}
                            placeholder="Label name (e.g. v1.0-draft)..."
                            className="h-6 text-[11px] px-2"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newLabelText.trim()) {
                                addLabelMutation.mutate({
                                  version: v.version,
                                  label: newLabelText.trim(),
                                });
                              } else if (e.key === 'Escape') {
                                setLabelingVersion(null);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={!newLabelText.trim() || addLabelMutation.isPending}
                            onClick={() =>
                              addLabelMutation.mutate({
                                version: v.version,
                                label: newLabelText.trim(),
                              })
                            }
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => setLabelingVersion(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                          <span>{v.fileCount || 1} files</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLabelingVersion(v.version);
                              setNewLabelText('');
                            }}
                            className="hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Plus className="size-2.5" />
                            <span>Add label</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Right Column: File Diffs & Content Viewer ── */}
          <main className="flex-1 flex flex-col overflow-hidden bg-background">
            {isLoadingDiff ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span>Computing differences between v{selectedBaseVersion} and v{selectedTargetVersion}...</span>
              </div>
            ) : !diffData || diffData.files.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs p-6 text-center">
                <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <Check className="size-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">No differences detected</h3>
                <p className="text-muted-foreground text-xs mt-1 max-w-sm">
                  The files in Version {selectedTargetVersion} are identical to Version {selectedBaseVersion}.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Changed Files Tab Bar */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b overflow-x-auto shrink-0 select-none">
                  <span className="text-xs font-semibold text-muted-foreground mr-1.5 uppercase tracking-wider text-[10px]">
                    Files:
                  </span>
                  {diffData.files.map((file) => {
                    const isActive = file.path === activeFilePath;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setActiveFilePath(file.path)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors shrink-0 cursor-pointer',
                          isActive
                            ? 'bg-background text-foreground border shadow-xs font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <FileText className="size-3 shrink-0" />
                        <span>{file.path}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                          +{file.additions}
                        </span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-sans">
                          -{file.deletions}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active File Diff Action Bar */}
                {activeFileDiff && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b text-xs shrink-0 select-none">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="font-mono font-semibold text-foreground text-xs">{activeFileDiff.path}</span>
                      <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400">+{activeFileDiff.additions}</span>
                        <span className="text-rose-600 dark:text-rose-400">-{activeFileDiff.deletions}</span>
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Copy Base File */}
                      {selectedBaseVersion && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 cursor-pointer"
                          onClick={handleCopyBaseFile}
                          title={`Copy entire content of ${activeFileDiff.path} from Version ${selectedBaseVersion}`}
                        >
                          <Copy className="size-3" />
                          <span className="hidden sm:inline">Copy v{selectedBaseVersion} File</span>
                        </Button>
                      )}

                      {/* 1-Click Partial Restore for this file */}
                      {selectedBaseVersion && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant={confirmingFileRestore ? 'destructive' : 'secondary'}
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
                            disabled={restoreSingleFileMutation.isPending}
                            onClick={() => {
                              if (confirmingFileRestore) {
                                restoreSingleFileMutation.mutate();
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
                                ? `Confirm restore ${activeFileDiff.path.split('/').pop() || 'file'} to v${selectedBaseVersion}`
                                : 'Restore this file'}
                            </span>
                          </Button>

                          {confirmingFileRestore && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingFileRestore(false)}
                              className="h-7 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Diff Viewer Area */}
                <div className="flex-1 p-3 overflow-hidden min-h-0">
                  {viewMode === 'split' ? (
                    activeFileDiff ? (
                      <SideBySideDiffViewer
                        fileDiff={activeFileDiff}
                        baseVersion={selectedBaseVersion || 1}
                        targetVersion={selectedTargetVersion || 2}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                        Select a file above to view changes.
                      </div>
                    )
                  ) : activeFileDiff ? (
                    <UnifiedDiffViewer
                      fileDiff={activeFileDiff}
                      baseVersion={selectedBaseVersion || 1}
                      targetVersion={selectedTargetVersion || 2}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                      Select a file above to view changes.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
