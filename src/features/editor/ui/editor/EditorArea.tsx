/**
 * EditorArea.tsx
 *
 * Canonical VS Code-Style Editor Area Container (Block 4: UI Features Layer).
 * Location: `features/editor/ui/features/editor/EditorArea.tsx`
 *
 * Replaces legacy EditorColumn.
 * Integrates:
 * - Multi-file Tab Bar (with dirty indicators and 0ms switching).
 * - Breadcrumb Navigation (Project > Subfolder > File.tex).
 * - Scoped Format Toolbar (LaTeX formatting).
 * - CodeMirror 6 Surface (with LRU Cache, Diagnostics Gutter, Engine Adapter).
 * - Image Asset Viewer (ImagePanel).
 */

'use client';

import React from 'react';
import { FileCode2 } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { Button } from '@/shared/components/ui/button';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/components/ui/resizable';
import { toast } from 'sonner';

import { EditorPane } from './EditorPane';
import dynamic from 'next/dynamic';

const DraftRecoveryDialog = dynamic(
  () => import('@/features/editor/ui/modals/DraftRecoveryDialog').then((m) => m.DraftRecoveryDialog),
  { ssr: false }
);

const DocumentConflictDialog = dynamic(
  () => import('@/features/editor/ui/modals/DocumentConflictDialog').then((m) => m.DocumentConflictDialog),
  { ssr: false }
);

import { useActiveDocument } from '@/features/editor/ui/hooks/useActiveDocument';
import {
  useSettingsStore,
  useWorkspaceStore,
  editorCommandBus,
  sessionCoordinator,
  type DraftSnapshot,
  type DocumentConflict,
} from '@/features/editor/core';
import { reviewCoordinator } from '@/features/editor/subsystems/review';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer';
import { extractProjectId } from '@/features/editor/domain/types/core.types';

interface EmptyEditorStateProps {
  onOpenDefaultFile?: () => void;
  fileName?: string;
}

function EmptyEditorState({ onOpenDefaultFile, fileName = 'main.tex' }: EmptyEditorStateProps) {
  return (
    <PlaneEmptyState
      variant="document"
      title="No file open"
      description="Select a document from the Files explorer or reopen the default manuscript to start writing."
      action={
        onOpenDefaultFile ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenDefaultFile}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <FileCode2 className="size-3.5 shrink-0 opacity-70" />
            <span>Open {fileName}</span>
          </Button>
        ) : undefined
      }
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full w-full flex flex-col bg-canvas">
      <div className="h-9 border-b border-border bg-secondary/40 flex items-center gap-2 px-3">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-5 rounded-sm" />
        <Skeleton className="h-5 w-5 rounded-sm" />
      </div>
      <div className="h-10 border-b border-border bg-background flex items-center gap-px px-2">
        {[100, 120, 80].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
        ))}
      </div>
      <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-5 space-y-2.5">
        {Array.from({ length: 22 }).map((_, i) => {
          const widths = ['65%', '45%', '80%', '30%', '55%', '85%', '40%', '70%', '25%', '75%', '50%', '35%'];
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-7 text-right">
                <Skeleton className="h-3 w-4 ml-auto opacity-40" />
              </span>
              <Skeleton className="h-3.5 rounded-sm" style={{ width: widths[i % widths.length] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EditorArea() {
  const {
    isLoading,
    activePage,
    isAssetTab,
    displayPage,
    pageId,
    selectedAsset,
    selectFile,
    parentPage,
    childFiles,
  } = useActiveDocument();

  const editorSplitMode = useWorkspaceStore((s) => s.editorSplitMode);
  const editorSplitRatio = useWorkspaceStore((s) => s.editorSplitRatio);
  const activeEditorPane = useWorkspaceStore((s) => s.activeEditorPane);
  const secondaryFileId = useWorkspaceStore((s) => s.secondaryFileId);
  const setEditorSplitRatio = useWorkspaceStore((s) => s.setEditorSplitRatio);
  const setActiveEditorPane = useWorkspaceStore((s) => s.setActiveEditorPane);
  const setSecondaryFileId = useWorkspaceStore((s) => s.setSecondaryFileId);
  const setEditorSplitMode = useWorkspaceStore((s) => s.setEditorSplitMode);

  const secondaryFile = React.useMemo(() => {
    if (secondaryFileId) {
      if (parentPage && parentPage.id === secondaryFileId) return parentPage;
      const found = childFiles.find((f) => f.id === secondaryFileId);
      if (found) return found;
    }
    return childFiles.find((f) => f.id !== displayPage?.id) ?? parentPage ?? displayPage ?? null;
  }, [secondaryFileId, childFiles, parentPage, displayPage]);

  const allSelectableFiles = React.useMemo(() => {
    const list: Array<{ id: string; title?: string; filename?: string; name?: string }> = [];
    if (parentPage) {
      list.push({
        id: parentPage.id,
        title: parentPage.title || 'main.tex',
      });
    }
    for (const cf of childFiles) {
      if (!parentPage || cf.id !== parentPage.id) {
        list.push({
          id: cf.id,
          title: cf.title || ('name' in cf ? (cf as { name?: string }).name : cf.id),
        });
      }
    }
    return list;
  }, [parentPage, childFiles]);

  const handleOpenDefault = React.useCallback(() => {
    if (pageId) {
      selectFile(pageId);
    }
  }, [pageId, selectFile]);

  const effectiveProjectId = extractProjectId(activePage) ?? extractProjectId(parentPage) ?? pageId;

  // Surface remote-vs-local conflicts with visual inspection & merge dialog
  const [activeConflict, setActiveConflict] = React.useState<DocumentConflict | null>(null);

  React.useEffect(() => {
    return sessionCoordinator.onConflict((conflict) => {
      setActiveConflict(conflict);
      toast.warning('Document conflict detected with server', {
        id: `doc-conflict-${conflict.fileId}`,
        duration: 15000,
        description: 'The document was updated on the server while you have unsaved local changes.',
        action: {
          label: 'Review & Resolve',
          onClick: () => setActiveConflict(conflict),
        },
      });
    });
  }, []);

  // Server version of the document (never the local cache) used for draft comparison.
  const serverContent =
    typeof displayPage?.content === 'string'
      ? displayPage.content
      : typeof displayPage?.content === 'object' && displayPage.content !== null && 'source' in displayPage.content
        ? String((displayPage.content as { source?: unknown }).source ?? '')
        : '';
  const serverContentRef = React.useRef(serverContent);
  serverContentRef.current = serverContent;

  // Offline draft recovery state
  const [recoverableDraft, setRecoverableDraft] = React.useState<
    (DraftSnapshot & { serverContent: string }) | null
  >(null);

  React.useEffect(() => {
    let isCancelled = false;
    const id = displayPage?.id;
    if (!id || isLoading) {
      setRecoverableDraft(null);
      return;
    }

    // Gate draft writes for this file until the user decides (or no draft exists).
    sessionCoordinator.beginDraftDecision(id);

    const checkDraft = async () => {
      const server = serverContentRef.current;
      try {
        const result = await sessionCoordinator.checkDraftRecoveryAsync(id, server);
        if (isCancelled) return;
        const live = lruDocumentCache.getModel(id);
        const alreadyLive = Boolean(live?.isDirty && result.draft && live.content === result.draft.content);
        if (result.hasRecoverableDraft && result.draft && !alreadyLive) {
          setRecoverableDraft({ ...result.draft, serverContent: server });
          return;
        }
      } catch (err) {
        console.warn('[EditorArea] Draft recovery check failed:', err);
      }
      if (!isCancelled) {
        setRecoverableDraft(null);
        sessionCoordinator.endDraftDecision(id);
      }
    };

    void checkDraft();

    return () => {
      isCancelled = true;
      sessionCoordinator.endDraftDecision(id);
    };
  }, [displayPage?.id, isLoading]);

  const handleRestoreDraft = React.useCallback(() => {
    if (!recoverableDraft || !displayPage?.id) return;
    const restoredContent = recoverableDraft.content;
    sessionCoordinator.restoreDraft(displayPage.id, restoredContent);
    editorCommandBus.dispatch({ type: 'editor:set-content', content: restoredContent });
    setRecoverableDraft(null);
    toast.success('Draft restored successfully!', { id: 'draft-recovery-status' });
  }, [recoverableDraft, displayPage?.id]);

  const handleDismissDraft = React.useCallback(() => {
    if (!displayPage?.id) return;
    sessionCoordinator.discardDraft(displayPage.id);
    setRecoverableDraft(null);
    toast.info('Kept server version', { id: 'draft-recovery-status' });
  }, [displayPage?.id]);

  // Global shortcut (Ctrl+Alt+M / Cmd+Alt+M) -> Add Comment / Open Review in both modes
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== 'undefined' &&
        (/Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ||
          (typeof (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'string' &&
            /mac/i.test((navigator as { userAgentData?: { platform?: string } }).userAgentData!.platform!)));
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault();
        const currentMode = useWorkspaceStore.getState().editorSplitMode;
        if (currentMode === 'none') {
          const otherFile = childFiles.find((f) => f.id !== displayPage?.id);
          const targetId = otherFile?.id || parentPage?.id || displayPage?.id;
          if (targetId) {
            setSecondaryFileId(targetId);
          }
          setEditorSplitMode('vertical');
          setActiveEditorPane('secondary');
        } else {
          editorCommandBus.dispatch({ type: 'editor:close-split' });
        }
        return;
      }

      if (modKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        useSettingsStore.getState().toggleEditorMode();
        return;
      }

      if (modKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        reviewCoordinator.initiateComment();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [childFiles, displayPage?.id, parentPage?.id, setActiveEditorPane, setEditorSplitMode, setSecondaryFileId]);

  if (isLoading) return <LoadingSkeleton />;

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full bg-canvas">
        <p className="text-muted-foreground text-sm">Page not found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-canvas min-h-0">
      {/* ── Draft Recovery Dialog (explicit decision required) ── */}
      {recoverableDraft && displayPage && (
        <DraftRecoveryDialog
          open
          fileName={displayPage.title || 'main.tex'}
          draftContent={recoverableDraft.content}
          serverContent={recoverableDraft.serverContent}
          savedAt={recoverableDraft.savedAt}
          onRestore={handleRestoreDraft}
          onKeepServer={handleDismissDraft}
        />
      )}

      {/* ── Document Conflict Dialog (explicit decision & diff/merge) ── */}
      {activeConflict && (
        <DocumentConflictDialog
          open={Boolean(activeConflict)}
          conflict={activeConflict}
          fileName={displayPage?.title || 'main.tex'}
          onResolve={(resolution, mergedContent) => {
            sessionCoordinator.resolveConflict(activeConflict.fileId, resolution, mergedContent);
            setActiveConflict(null);
          }}
          onClose={() => setActiveConflict(null)}
        />
      )}

      {/* ── Core Editor Body (Split-Aware: 1 or 2 Panes) ───────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col">
        {!displayPage && !isAssetTab ? (
          <EmptyEditorState
            onOpenDefaultFile={handleOpenDefault}
            fileName="main.tex"
          />
        ) : editorSplitMode === 'vertical' ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full w-full min-h-0 min-w-0"
            onLayout={(layout) => {
              const primarySize = layout.primary ?? Object.values(layout)[0];
              if (primarySize !== undefined) {
                setEditorSplitRatio(primarySize / 100);
              }
            }}
          >
            <ResizablePanel
              id="primary"
              defaultSize={Math.round((editorSplitRatio || 0.5) * 100)}
              minSize={20}
              maxSize={80}
              className="min-h-0 min-w-0"
            >
              <EditorPane
                paneId="primary"
                file={isAssetTab ? selectedAsset : displayPage}
                projectId={effectiveProjectId}
                rootPageId={pageId}
                isActivePane={activeEditorPane === 'primary'}
                isSplitActive={true}
                availableFiles={allSelectableFiles}
                onFocusPane={() => setActiveEditorPane('primary')}
                onCloseSplit={() => {
                  if (secondaryFile?.id) {
                    selectFile(secondaryFile.id);
                  }
                  editorCommandBus.dispatch({ type: 'editor:close-split' });
                }}
                onSwapPanes={() => editorCommandBus.dispatch({ type: 'editor:swap-panes' })}
                onSelectFile={(selectedId) => selectFile(selectedId)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="secondary"
              defaultSize={Math.round((1 - (editorSplitRatio || 0.5)) * 100)}
              minSize={20}
              maxSize={80}
              className="min-h-0 min-w-0"
            >
              <EditorPane
                paneId="secondary"
                file={secondaryFile}
                projectId={effectiveProjectId}
                rootPageId={pageId}
                isActivePane={activeEditorPane === 'secondary'}
                isSplitActive={true}
                availableFiles={allSelectableFiles}
                onFocusPane={() => setActiveEditorPane('secondary')}
                onCloseSplit={() => editorCommandBus.dispatch({ type: 'editor:close-split' })}
                onSwapPanes={() => editorCommandBus.dispatch({ type: 'editor:swap-panes' })}
                onSelectFile={(selectedId) => {
                  setSecondaryFileId(selectedId);
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <EditorPane
            paneId="primary"
            file={isAssetTab ? selectedAsset : displayPage}
            projectId={effectiveProjectId}
            rootPageId={pageId}
            isActivePane={true}
            isSplitActive={false}
            availableFiles={allSelectableFiles}
            onFocusPane={() => setActiveEditorPane('primary')}
            onSplitRight={() => {
              const otherFile = childFiles.find((f) => f.id !== displayPage?.id);
              const targetId = otherFile?.id || parentPage?.id || displayPage?.id;
              if (targetId) {
                setSecondaryFileId(targetId);
              }
              setEditorSplitMode('vertical');
              setActiveEditorPane('secondary');
            }}
            onSelectFile={(selectedId) => selectFile(selectedId)}
          />
        )}
      </div>
    </div>
  );
}

export default EditorArea;
