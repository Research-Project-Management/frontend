/**
 * EditorArea.tsx
 *
 * Canonical VS Code-Style Editor Area Container (Block 4: UI Features Layer).
 * Location: `features/editor/core/surface/EditorArea.tsx`
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
import { logger } from '@/shared/lib/logger';

import { EditorPane } from './EditorPane';
import dynamic from 'next/dynamic';

const DocumentConflictDialog = dynamic(
  () => import('@/features/editor/core/surface/modals/DocumentConflictDialog').then((m) => m.DocumentConflictDialog),
  { ssr: false }
);

const SymbolPalette = dynamic(
  () => import('@/features/editor/subsystems/insert/ui/SymbolPalette'),
  { ssr: false },
);

import { useActiveDocument } from '@/features/editor/core/queries/useActiveDocument';
import {
  useWorkspaceStore,
  usePageStore,
  editorCommandBus,
  sessionCoordinator,
  isPrimaryModKey,
  DEFAULT_MAIN_FILE,
  type DocumentConflict,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { extractProjectId, extractDocumentContentString } from '@/features/editor/domain/types/core.types';

interface EmptyEditorStateProps {
  onOpenDefaultFile?: () => void;
  fileName?: string;
}

function EmptyEditorState({ onOpenDefaultFile, fileName = DEFAULT_MAIN_FILE }: EmptyEditorStateProps) {
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
  const secondaryActiveByProject = useWorkspaceStore((s) => s.secondaryActiveByProject);
  const setEditorSplitRatio = useWorkspaceStore((s) => s.setEditorSplitRatio);
  const setActiveEditorPane = useWorkspaceStore((s) => s.setActiveEditorPane);
  const setSecondaryFileId = useWorkspaceStore((s) => s.setSecondaryFileId);
  const setSecondaryActiveTab = useWorkspaceStore((s) => s.setSecondaryActiveTab);
  const setEditorSplitMode = useWorkspaceStore((s) => s.setEditorSplitMode);

  const effectiveSecondaryFileId =
    (pageId ? secondaryActiveByProject[pageId] : undefined) ?? secondaryFileId;

  const secondaryFile = React.useMemo(() => {
    if (effectiveSecondaryFileId) {
      if (parentPage && parentPage.id === effectiveSecondaryFileId) return parentPage;
      const found = childFiles.find((f) => f.id === effectiveSecondaryFileId);
      if (found) return found;
    }
    return childFiles.find((f) => f.id !== displayPage?.id) ?? parentPage ?? displayPage ?? null;
  }, [effectiveSecondaryFileId, childFiles, parentPage, displayPage]);

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

  const storeSpaceId = usePageStore((s) => s.spaceId);
  const effectiveProjectId =
    storeSpaceId || extractProjectId(activePage) || extractProjectId(parentPage) || pageId;

  // Surface remote-vs-local conflicts with visual inspection & merge dialog
  const [activeConflict, setActiveConflict] = React.useState<DocumentConflict | null>(null);
  const [symbolPaletteOpen, setSymbolPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubOpen = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'symbol-palette') {
        setSymbolPaletteOpen((prev) => (cmd.payload?.forceOpen ? true : !prev));
      }
    });
    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'symbol-palette') {
        setSymbolPaletteOpen(false);
      }
    });
    return () => {
      unsubOpen();
      unsubClose();
    };
  }, []);

  React.useEffect(() => {
    return sessionCoordinator.onConflict((conflict) => {
      setActiveConflict(conflict);
      toast.warning('Document conflict detected with server', {
        id: `doc-conflict-${conflict.fileId}`,
        duration: 15000,
        description: 'The document was updated on the server while you have unsaved local changes.',
      });
    });
  }, []);

  // Server version of the document (never the local cache) used for draft comparison.
  const serverContent = extractDocumentContentString(displayPage?.content);
  const serverContentRef = React.useRef(serverContent);
  serverContentRef.current = serverContent;

  // Unsynced local edit recovery state
  // Global shortcut (Ctrl+\ / Cmd+\) -> Split Editor Pane
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modKey = isPrimaryModKey(e);

      if (modKey && e.altKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'review:create-comment' });
        return;
      }

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
    <div className="flex-1 h-full w-full flex flex-col bg-canvas min-h-0">
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
              className="h-full flex flex-col min-h-0 min-w-0"
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
              className="h-full flex flex-col min-h-0 min-w-0"
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
                  if (pageId) {
                    setSecondaryActiveTab(pageId, selectedId);
                  }
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
            onSelectFile={(selectedId) => selectFile(selectedId)}
          />
        )}
      </div>

      {/* ── Bottom-Docked Symbol Palette (Overleaf Parity) ────────────────── */}
      {symbolPaletteOpen && (
        <SymbolPalette
          open={symbolPaletteOpen}
          onClose={() => setSymbolPaletteOpen(false)}
          onInsert={(symbol) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: symbol });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
        />
      )}
    </div>
  );
}

export default EditorArea;
