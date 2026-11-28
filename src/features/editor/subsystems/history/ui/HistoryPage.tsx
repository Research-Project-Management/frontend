'use client';

/**
 * HistoryPage.tsx
 *
 * Project History & Visual Diff Comparison Page (Overleaf 3-Column Parity).
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Loader2, ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

import { pagesService } from '@/features/editor/sdk/pages.service';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import {
  buildPageScopeHref,
  PERSONAL_SPACE_PARAM,
  useEditorScope,
  usePageStore,
} from '@/features/editor/core';

import { useHistoryState, useHistoryAutoSelect } from '../hooks/useHistoryState';
import { useHistoryActions } from '../hooks/useHistoryActions';
import { FileTreeSidebar } from './components/FileTreeSidebar';
import { SnapshotFileView } from './components/SnapshotFileView';
import { DiffPane } from './components/DiffPane';
import { TimelineSidebar } from './components/TimelineSidebar';

export interface HistoryPageProps {
  projectId?: string;
  pageId?: string;
  initialVersion?: number;
}

export function HistoryPage({
  projectId: propProjectId,
  pageId: propPageId,
  initialVersion,
}: HistoryPageProps) {
  const router = useRouter();
  const editorScope = useEditorScope({
    projectId: propProjectId,
    pageId: propPageId,
  });

  const currentPageId = usePageStore((s) => s.currentPage?.id ?? '');
  const currentPageTitle = usePageStore((s) => s.currentPage?.title ?? '');
  const storePermissions = usePageStore((s) => s.permissions);

  const isPersonalSpace = editorScope.spaceKind === 'personal';
  const normalizedRole = storePermissions?.role?.toLowerCase() ?? null;
  const canEditHistory =
    isPersonalSpace ||
    (storePermissions
      ? storePermissions.canEdit &&
        normalizedRole !== 'reviewer' &&
        normalizedRole !== 'viewer' &&
        normalizedRole !== 'revoked'
      : true);
  const canRestoreFullVersion =
    isPersonalSpace ||
    (storePermissions
      ? storePermissions.canEdit &&
        !['reviewer', 'viewer', 'revoked', 'contributor'].includes(normalizedRole || '')
      : true);
  const restoreDisabledReason = !canRestoreFullVersion
    ? normalizedRole === 'contributor'
      ? 'Only project coordinators or owners can restore an entire version'
      : 'View-only reviewers cannot restore versions'
    : undefined;

  const pageId = editorScope.rootPageId || currentPageId || '';
  const knownSpaceId = isPersonalSpace
    ? editorScope.spaceId
    : editorScope.projectId || editorScope.spaceId;

  const { data: resolvedPage } = useQuery({
    queryKey: ['history-page-meta', pageId],
    queryFn: () => pagesService.docs.getById(pageId),
    enabled: (!knownSpaceId || !currentPageTitle) && !!pageId,
    staleTime: 5 * 60_000,
  });

  const spaceId = isPersonalSpace
    ? knownSpaceId || resolvedPage?.spaceId || (pageId ? PERSONAL_SPACE_PARAM : '')
    : knownSpaceId || extractProjectId(resolvedPage) || resolvedPage?.spaceId || '';
  const effectiveTitle = currentPageTitle || resolvedPage?.title || '';

  const handleBackToEditor = useCallback(() => {
    if (pageId) {
      router.push(
        buildPageScopeHref(pageId, {
          spaceKind: editorScope.spaceKind,
          projectId: editorScope.projectId,
        }),
      );
      return;
    }
    router.push(
      !isPersonalSpace && editorScope.projectId
        ? `/projects/${encodeURIComponent(editorScope.projectId)}`
        : '/pages',
    );
  }, [editorScope.spaceKind, editorScope.projectId, isPersonalSpace, pageId, router]);

  const state = useHistoryState(initialVersion);

  const actions = useHistoryActions({
    open: true,
    spaceId,
    pageId,
    projectTitle: effectiveTitle,
    mode: state.mode,
    targetVersion: state.targetVersion,
    baseVersion: state.baseVersion,
    activeFile: state.activeFile,
    onRestoredProject: () => {
      state.setConfirmRestore(false);
      handleBackToEditor();
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
    const t = effectiveTitle.trim();
    document.title = t ? `History · ${t} · Flux` : 'History · Flux';
  }, [effectiveTitle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleBackToEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackToEditor]);

  const versionBadge =
    state.mode === 'single' && state.targetVersion != null
      ? `v${state.targetVersion}`
      : state.mode === 'compare' && state.targetVersion != null && state.baseVersion != null
        ? `v${state.baseVersion} → v${state.targetVersion}`
        : undefined;

  return (
    <div
      role="region"
      aria-label="Version History"
      className="flex flex-col w-full h-dvh bg-background overflow-hidden select-none font-sans"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-background shrink-0 select-none gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToEditor}
            className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer -ml-1 h-8"
            title="Return to the manuscript editor"
          >
            <ArrowLeft className="size-4" />
            <span>Back to editor</span>
          </Button>
          {versionBadge && (
            <>
              <div className="h-4 w-px bg-border/60" />
              <Badge variant="outline" className="text-11 font-mono py-0 h-5">
                {versionBadge}
              </Badge>
            </>
          )}
        </div>
      </header>

      {/* Project Restore Confirmation Bar */}
      {canRestoreFullVersion && state.confirmRestore && state.targetVersion != null && (
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
          error={state.mode === 'single' ? actions.snapshotError : actions.diffError}
          onRetry={() =>
            void (state.mode === 'single' ? actions.refetchSnapshot() : actions.refetchDiff())
          }
          versionLabel={versionBadge?.replace(' → ', '→')}
        />

        {state.mode === 'single' || state.baseVersion === state.targetVersion ? (
          <SnapshotFileView
            snapshot={actions.snapshot}
            isLoading={actions.isLoadingSnapshot}
            error={actions.snapshotError}
            onRetry={() => void actions.refetchSnapshot()}
            activeFile={state.activeFile}
            version={state.targetVersion}
            isRestoring={actions.restoreFile.isPending}
            confirmRestore={state.confirmFileRestore}
            onConfirmRestoreChange={state.setConfirmFileRestore}
            onRestoreFile={(v) => actions.restoreFile.mutate(v)}
            canRestoreFile={canEditHistory}
          />
        ) : (
          <DiffPane
            diffData={actions.diffData}
            isLoadingDiff={actions.isLoadingDiff}
            error={actions.diffError}
            onRetry={() => void actions.refetchDiff()}
            activeFilePath={state.activeFile}
            selectedBaseVersion={state.baseVersion}
            selectedTargetVersion={state.targetVersion}
            onRestoreSingleFile={() => actions.restoreFile.mutate(undefined)}
            isRestoringSingleFile={actions.restoreFile.isPending}
            confirmingFileRestore={state.confirmFileRestore}
            setConfirmingFileRestore={state.setConfirmFileRestore}
            canRestoreFile={canEditHistory}
          />
        )}

        <TimelineSidebar
          versions={actions.versions}
          isLoadingVersions={actions.isLoadingVersions}
          error={actions.versionsError}
          onRetry={() => void actions.refetchVersions()}
          historyMode={state.mode}
          filter={state.filter}
          setFilter={state.setFilter}
          selectedTargetVersion={state.targetVersion}
          selectedBaseVersion={state.baseVersion}
          onSelectVersion={(v) => state.selectVersion(v, actions.versions)}
          onSelectBaseVersion={state.setBaseVersion}
          onAddLabel={(version, label) => actions.addLabel.mutate({ version, label })}
          onDeleteLabel={(labelId) => actions.deleteLabel.mutate(labelId)}
          onDownloadVersion={(v) => void actions.downloadZip(v)}
          onRestoreVersion={(v) => {
            if (!canRestoreFullVersion) return;
            state.requestRestoreVersion(v, actions.versions);
          }}
          canRestoreVersion={canRestoreFullVersion}
          restoreDisabledReason={restoreDisabledReason}
          canManageLabels={canEditHistory}
          isAddingLabelLoading={actions.addLabel.isPending}
        />
      </div>
    </div>
  );
}

export default HistoryPage;
