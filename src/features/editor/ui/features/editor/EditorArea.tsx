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
import { FileCode2, WifiOff } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState, Button } from '@/shared/components/ui';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/components/ui/resizable';
import { toast } from 'sonner';

import { EditorPane } from './EditorPane';
import { DraftRecoveryDialog } from './DraftRecoveryDialog';

import { useActiveDocument } from '../../hooks/use-active-document';
import { useEditorCollaboration } from '../../hooks/use-collaboration';
import { useSettingsStore } from '../../../store/settings.store';
import { usePageStore } from '../../../store/editor.store';
import { useDocumentCollaborationStore } from '../../../store/collaboration.store';
import { useLayoutStore } from '../../../store/layout.store';
import { useConnectivityStore } from '../../../store/connectivity.store';
import { getActiveEditorEngine, editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { extractProjectId } from '@/features/editor/domain/types';
import { sessionCoordinator, type DraftSnapshot } from '@/features/editor/coordinators/session.coordinator';

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
    fileId,
    selectedAsset,
    selectFile,
    parentPage,
    childFiles,
  } = useActiveDocument();

  const showEditorTabs = useSettingsStore((s) => s.showEditorTabs);
  const editorMode = useSettingsStore((s) => s.editorMode);

  const editorSplitMode = useLayoutStore((s) => s.editorSplitMode);
  const editorSplitRatio = useLayoutStore((s) => s.editorSplitRatio);
  const activeEditorPane = useLayoutStore((s) => s.activeEditorPane);
  const secondaryFileId = useLayoutStore((s) => s.secondaryFileId);
  const setEditorSplitRatio = useLayoutStore((s) => s.setEditorSplitRatio);
  const setActiveEditorPane = useLayoutStore((s) => s.setActiveEditorPane);
  const setSecondaryFileId = useLayoutStore((s) => s.setSecondaryFileId);
  const setEditorSplitMode = useLayoutStore((s) => s.setEditorSplitMode);

  const secondaryFile = React.useMemo(() => {
    if (secondaryFileId) {
      const found = childFiles.find((f) => f.id === secondaryFileId);
      if (found) return found;
    }
    return childFiles.find((f) => f.id !== displayPage?.id) ?? displayPage ?? null;
  }, [secondaryFileId, childFiles, displayPage]);

  const handleOpenDefault = React.useCallback(() => {
    if (pageId) {
      selectFile(pageId);
    }
  }, [pageId, selectFile]);

  const cachedModel = displayPage?.id ? lruDocumentCache.getModel(displayPage.id) : null;
  const rawContent =
    cachedModel?.content !== undefined
      ? cachedModel.content
      : typeof displayPage?.content === 'string'
        ? displayPage.content
        : typeof displayPage?.content === 'object' && displayPage.content !== null && 'source' in displayPage.content
          ? String((displayPage.content as { source?: unknown }).source ?? '')
          : '';

  const effectiveProjectId = extractProjectId(activePage) ?? extractProjectId(parentPage) ?? pageId;
  const { yText, awareness, status: realtimeStatus } = useEditorCollaboration({
    projectId: effectiveProjectId,
    fileId: displayPage?.id,
    initialValue: rawContent,
    enabled: Boolean(!isLoading && activePage && displayPage && effectiveProjectId && editorMode !== 'visual'),
  });

  const isOnline = useConnectivityStore((s) => s.isOnline);
  const offlinePendingCompile = useConnectivityStore((s) => s.offlinePendingCompile);
  const isRealtimeConnected = Boolean(yText) && realtimeStatus === 'connected';

  // Report the *actual* realtime connection status so HTTP autosave resumes when disconnected.
  React.useEffect(() => {
    const id = displayPage?.id;
    if (!id) return;
    sessionCoordinator.setRealtimeConnected(id, isRealtimeConnected);
  }, [displayPage?.id, isRealtimeConnected]);

  // Surface remote-vs-local conflicts instead of silently dropping remote edits.
  React.useEffect(() => {
    return sessionCoordinator.onConflict((conflict) => {
      toast.warning('Tài liệu đã được cập nhật từ nơi khác trong khi bạn có thay đổi chưa lưu.', {
        id: `doc-conflict-${conflict.fileId}`,
        duration: Infinity,
        description: 'Thay đổi của bạn vẫn được giữ và sao lưu cục bộ. Chọn phiên bản muốn dùng.',
        action: {
          label: 'Dùng bản từ xa',
          onClick: () => sessionCoordinator.resolveConflict(conflict.fileId, 'take-remote'),
        },
        cancel: {
          label: 'Giữ bản của tôi',
          onClick: () => sessionCoordinator.resolveConflict(conflict.fileId, 'keep-local'),
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
    toast.success('Đã khôi phục bản nháp thành công!');
  }, [recoverableDraft, displayPage?.id]);

  const handleDismissDraft = React.useCallback(() => {
    if (!displayPage?.id) return;
    sessionCoordinator.discardDraft(displayPage.id);
    setRecoverableDraft(null);
    toast.info('Đã giữ phiên bản trên máy chủ');
  }, [displayPage?.id]);

  // Global shortcut (Ctrl+Alt+M / Cmd+Alt+M) -> Add Comment / Open Review in both modes
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        useSettingsStore.getState().toggleEditorMode();
        return;
      }

      if (modKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const engine = getActiveEditorEngine();
        const sel = engine?.getSelection?.();
        const cursor = engine?.getCursorPosition?.();

        const startLine = sel?.startLine ?? sel?.fromLine ?? cursor?.line ?? 1;
        const endLine = sel?.endLine ?? sel?.toLine ?? cursor?.line ?? 1;
        const selectedText = engine?.getSelectedText?.() || '';

        useDocumentCollaborationStore.getState().setPendingComment({
          startLine,
          endLine,
          selectedText,
        });
        useLayoutStore.getState().setActiveSidebarTab('review');
        useLayoutStore.getState().setSidebarLeftOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      {/* ── Offline Mode Notice ── */}
      {!isOnline && (
        <div className="flex items-center justify-between px-3 py-1 bg-warning/10 border-b border-warning/20 text-warning text-xs shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="size-3.5 shrink-0 text-warning" />
            <span>
              {offlinePendingCompile
                ? 'Đang ngoại tuyến: Bản nháp đã được lưu vào IndexedDB. Quá trình biên dịch đã được xếp hàng.'
                : 'Đang ngoại tuyến: Các thay đổi đang được lưu an toàn vào bộ nhớ máy (IndexedDB). Sẽ tự động đồng bộ khi có mạng.'}
            </span>
          </div>
          <span className="text-[10px] text-warning/80 font-mono hidden sm:inline">
            Tự động đồng bộ khi kết nối lại
          </span>
        </div>
      )}

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
                availableFiles={childFiles}
                onFocusPane={() => setActiveEditorPane('primary')}
                onCloseSplit={() => editorCommandBus.dispatch({ type: 'editor:close-split' })}
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
                availableFiles={childFiles}
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
            availableFiles={childFiles}
            onFocusPane={() => setActiveEditorPane('primary')}
            onSplitRight={() => {
              const otherFile = childFiles.find((f: any) => f.id !== displayPage?.id);
              const targetId = otherFile?.id || displayPage?.id;
              if (targetId) {
                setSecondaryFileId(targetId);
              }
              setEditorSplitMode('vertical');
            }}
            onSelectFile={(selectedId) => selectFile(selectedId)}
          />
        )}
      </div>
    </div>
  );
}

export default EditorArea;
