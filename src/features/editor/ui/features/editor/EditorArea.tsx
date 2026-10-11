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
import { FileCode2, AlertCircle, WifiOff } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState, Button } from '@/shared/components/ui';
import { toast } from 'sonner';

import Tabs from './EditorTabs';
import { ImagePanel } from './ImagePanel';
import { CodeMirrorView } from './CodeMirrorView';
import { EditorContextMenu } from './EditorContextMenu';
import { VisualEditorView } from './VisualEditorView';
import { EditorToolbar } from './EditorToolbar';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';

import { useActiveDocument } from '../../hooks/use-core';
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
  const { yText, awareness } = useEditorCollaboration({
    projectId: effectiveProjectId,
    fileId: displayPage?.id,
    initialValue: rawContent,
    enabled: Boolean(!isLoading && activePage && displayPage && effectiveProjectId && editorMode !== 'visual'),
  });

  const isOnline = useConnectivityStore((s) => s.isOnline);
  const offlinePendingCompile = useConnectivityStore((s) => s.offlinePendingCompile);

  // Offline draft recovery state
  const [recoverableDraft, setRecoverableDraft] = React.useState<DraftSnapshot | null>(null);

  React.useEffect(() => {
    let isCancelled = false;
    if (!displayPage?.id) {
      setRecoverableDraft(null);
      return;
    }

    const checkDraft = async () => {
      try {
        const result = await sessionCoordinator.checkDraftRecoveryAsync(displayPage.id, rawContent);
        if (!isCancelled && result.hasRecoverableDraft && result.draft) {
          setRecoverableDraft(result.draft);
        } else if (!isCancelled) {
          setRecoverableDraft(null);
        }
      } catch {
        if (!isCancelled) setRecoverableDraft(null);
      }
    };

    void checkDraft();

    return () => {
      isCancelled = true;
    };
  }, [displayPage?.id, rawContent]);

  const handleRestoreDraft = React.useCallback(() => {
    if (!recoverableDraft || !displayPage?.id) return;
    const restoredContent = recoverableDraft.content;
    lruDocumentCache.updateContent(displayPage.id, restoredContent, true);
    sessionCoordinator.notifyContentChange(displayPage.id, restoredContent, {
      isRealtimeActive: false,
    });
    editorCommandBus.dispatch({ type: 'editor:set-content', content: restoredContent });
    setRecoverableDraft(null);
    toast.success('Đã khôi phục bản nháp ngoại tuyến thành công!');
  }, [recoverableDraft, displayPage?.id]);

  const handleDismissDraft = React.useCallback(() => {
    if (!displayPage?.id) return;
    sessionCoordinator.clearDraftSnapshot(displayPage.id);
    setRecoverableDraft(null);
    toast.info('Đã bỏ qua bản nháp ngoại tuyến');
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

        const startLine = sel?.fromLine ?? cursor?.line ?? 1;
        const endLine = sel?.toLine ?? cursor?.line ?? 1;
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
      {/* ── Multi-file Tabs Header (Overleaf Parity: holds file tabs + SourceVisualSwitcher) ── */}
      {showEditorTabs && pageId ? (
        <Tabs
          rootPageId={pageId}
          activeFileId={fileId ?? activePage.id ?? ''}
          availableFiles={childFiles}
        />
      ) : (
        <div className="flex items-center justify-end h-8 bg-muted/20 border-b border-border px-2 shrink-0">
          <SourceVisualSwitcher />
        </div>
      )}

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

      {/* ── Offline Draft Recovery Banner ── */}
      {recoverableDraft && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-warning/10 border-b border-warning/30 text-warning text-xs shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5 shrink-0 text-warning" />
            <span>
              Phát hiện bản nháp ngoại tuyến chưa lưu ({new Date(recoverableDraft.savedAt).toLocaleTimeString()}). Bạn có muốn khôi phục không?
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="h-6 px-2.5 text-xs bg-warning hover:bg-warning/90 text-white font-medium"
              onClick={handleRestoreDraft}
            >
              Khôi phục bản nháp
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleDismissDraft}
            >
              Bỏ qua
            </Button>
          </div>
        </div>
      )}

      {/* ── Core Editor Body ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col">
        {isAssetTab ? (
          <ImagePanel asset={selectedAsset!} />
        ) : displayPage ? (
          <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col bg-canvas">
            {editorMode === 'visual' && <EditorToolbar />}
            <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
              {editorMode === 'visual' ? (
                <VisualEditorView
                  fileId={displayPage.id}
                  filePath={displayPage.title || 'main.tex'}
                  value={rawContent}
                  onChange={(nextText) => {
                    lruDocumentCache.updateContent(displayPage.id, nextText, true);
                    sessionCoordinator.notifyContentChange(displayPage.id, nextText, {
                      isRealtimeActive: false,
                    });
                  }}
                />
              ) : (
                <EditorContextMenu>
                  <CodeMirrorView
                    fileId={displayPage.id}
                    filePath={displayPage.title || 'main.tex'}
                    value={rawContent}
                    yText={yText}
                    awareness={awareness}
                    projectId={effectiveProjectId}
                  />
                </EditorContextMenu>
              )}
            </div>
          </div>
        ) : (
          <EmptyEditorState
            onOpenDefaultFile={handleOpenDefault}
            fileName="main.tex"
          />
        )}
      </div>
    </div>
  );
}

export default EditorArea;
