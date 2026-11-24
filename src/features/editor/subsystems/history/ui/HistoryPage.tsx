'use client';

/**
 * HistoryPage.tsx
 *
 * Project History & Visual Diff Comparison Page (Overleaf 3-Column Parity).
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RotateCcw, Columns2, AlignJustify, Loader2, ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { usePageStore } from '@/features/editor/core';

import { useHistoryState, useHistoryAutoSelect } from './hooks/useHistoryState';
import { useHistoryActions } from './hooks/useHistoryActions';
import { FileTreeSidebar } from './components/FileTreeSidebar';
import { SnapshotFileView } from './components/SnapshotFileView';
import { DiffPane } from './components/DiffPane';
import { TimelineSidebar } from './components/TimelineSidebar';

export interface HistoryPageProps {
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
  const params = useParams<{ projectId?: string; pageId?: string }>();

  const currentPageId = usePageStore((s) => s.currentPage?.id ?? '');
  const currentPageTitle = usePageStore((s) => s.currentPage?.title ?? '');
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage) ?? '');
  const storeSpaceId = usePageStore((s) => s.spaceId);
  const storeRootPageId = usePageStore((s) => s.rootPageId || s.parentPageId || '');

  const pageId = propPageId || params?.pageId || storeRootPageId || currentPageId || '';
  const spaceId =
    storeSpaceId || propProjectId || params?.projectId || currentPageProjectId || pageId || '';

  const handleClose = useCallback(() => {
    if (onClose) return onClose();
    if (onOpenChange) return onOpenChange(false);

    const isPersonal = !params?.projectId || params.projectId === 'personal';
    if (isPersonal) {
      router.push(pageId ? `/pages/${pageId}` : '/pages');
    } else {
      router.push(
        pageId ? `/projects/${params.projectId}/pages/${pageId}` : `/projects/${params.projectId}/pages`,
      );
    }
  }, [onClose, onOpenChange, params?.projectId, pageId, router]);

  const state = useHistoryState(initialVersion);

  const actions = useHistoryActions({
    open,
    spaceId,
    pageId,
    projectTitle: currentPageTitle,
    mode: state.mode,
    targetVersion: state.targetVersion,
    baseVersion: state.baseVersion,
    activeFile: state.activeFile,
    onRestoredProject: () => {
      state.setConfirmRestore(false);
      handleClose();
    },
    onRestoredFile: () => {
      state.setConfirmFileRestore(false);
    },
  });

  const sidebarFiles = useMemo(() => {
    if (state.mode === 'single') {
      return Object.keys(actions.snapshot?.files ?? {})
        .sort()
        .map((path) => ({ path }));
    }
    return (actions.diffData?.files ?? []).map((f) => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    }));
  }, [state.mode, actions.snapshot, actions.diffData]);

  useHistoryAutoSelect(actions.versions, sidebarFiles, state);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const versionBadge =
    state.mode === 'single' && state.targetVersion != null
      ? `v${state.targetVersion}`
      : state.mode === 'compare' && state.targetVersion != null && state.baseVersion != null
        ? `v${state.baseVersion} → v${state.targetVersion}`
        : undefined;

  return (
    <div
      role="region"
      aria-label="Project Version History"
      className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-background overflow-hidden select-none font-sans"
    >
      {/* Top Header Bar */}
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
            {versionBadge && (
              <Badge variant="outline" className="text-[11px] font-mono py-0 h-5">
                {versionBadge}
              </Badge>
            )}
          </div>
        </div>

        {state.mode === 'compare' && (
          <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-muted-foreground shrink-0">
            <button
              type="button"
              onClick={() => state.setDiffView('unified')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                state.diffView === 'unified'
                  ? 'bg-muted text-foreground'
                  : 'hover:text-foreground',
              )}
              title="Unified Diff View"
            >
              <AlignJustify className="size-3.5" />
              <span className="hidden md:inline">Unified</span>
            </button>
            <button
              type="button"
              onClick={() => state.setDiffView('split')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer',
                state.diffView === 'split'
                  ? 'bg-muted text-foreground'
                  : 'hover:text-foreground',
              )}
              title="Side-by-Side Split Diff View"
            >
              <Columns2 className="size-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
          </div>
        )}
      </header>

      {/* Project Restore Confirmation Bar */}
      {state.confirmRestore && state.targetVersion != null && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs shrink-0">
          <div className="flex items-center gap-2 text-foreground">
            <RotateCcw className="size-3.5 text-destructive shrink-0" />
            <span>
              Restore project to{' '}
              <span className="font-mono font-semibold">v{state.targetVersion}</span>?
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
              disabled={actions.restoreProject.isPending}
              onClick={() => actions.restoreProject.mutate(state.targetVersion!)}
            >
              {actions.restoreProject.isPending ? (
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
              onClick={() => state.setConfirmRestore(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Main 3-Column Body */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        <FileTreeSidebar
          mode={state.mode}
          files={sidebarFiles}
          activeFilePath={state.activeFile}
          onSelectFile={state.setActiveFile}
          isLoading={state.mode === 'single' ? actions.isLoadingSnapshot : actions.isLoadingDiff}
          versionLabel={versionBadge?.replace(' → ', '→')}
        />

        {state.mode === 'single' ? (
          <SnapshotFileView
            snapshot={actions.snapshot}
            isLoading={actions.isLoadingSnapshot}
            activeFile={state.activeFile}
            version={state.targetVersion}
            isRestoring={actions.restoreFile.isPending}
            confirmRestore={state.confirmFileRestore}
            onConfirmRestoreChange={state.setConfirmFileRestore}
            onRestoreFile={(v) => actions.restoreFile.mutate(v)}
          />
        ) : (
          <DiffPane
            diffData={actions.diffData}
            isLoadingDiff={actions.isLoadingDiff}
            activeFilePath={state.activeFile}
            viewMode={state.diffView}
            selectedBaseVersion={state.baseVersion}
            selectedTargetVersion={state.targetVersion}
            onRestoreSingleFile={() => actions.restoreFile.mutate(undefined)}
            isRestoringSingleFile={actions.restoreFile.isPending}
            confirmingFileRestore={state.confirmFileRestore}
            setConfirmingFileRestore={state.setConfirmFileRestore}
          />
        )}

        <TimelineSidebar
          versions={actions.versions}
          isLoadingVersions={actions.isLoadingVersions}
          historyMode={state.mode}
          onHistoryModeChange={state.setMode}
          filter={state.filter}
          setFilter={state.setFilter}
          selectedTargetVersion={state.targetVersion}
          selectedBaseVersion={state.baseVersion}
          onSelectVersion={(v) => state.selectVersion(v, actions.versions)}
          onSelectBaseVersion={state.setBaseVersion}
          onAddLabel={(version, label) => actions.addLabel.mutate({ version, label })}
          onDeleteLabel={(labelId) => actions.deleteLabel.mutate(labelId)}
          onDownloadVersion={(v) => void actions.downloadZip(v)}
          onRestoreVersion={(v) => state.requestRestoreVersion(v, actions.versions)}
          isAddingLabelLoading={actions.addLabel.isPending}
        />
      </div>
    </div>
  );
}

export default HistoryPage;
