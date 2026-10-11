'use client';

/**
 * EditorPane.tsx
 *
 * Atomic Editor Pane Container (Layer 5: Presentation Layer).
 * Location: `features/editor/ui/features/editor/EditorPane.tsx`
 *
 * Responsible for rendering an isolated editor surface:
 * - Tab header or pane header (with split controls & mode switcher).
 * - CodeMirror 6 or Visual Editor view for the specific document.
 * - Image asset viewer for static graphics.
 * - Collaboration presence and awareness scoped to this pane.
 */

import React from 'react';
import { Columns2, ArrowLeftRight, X, FileCode2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import dynamic from 'next/dynamic';
import Tabs from './EditorTabs';
import { CodeMirrorView } from './CodeMirrorView';

const ImagePanel = dynamic(
  () => import('./ImagePanel').then((m) => m.ImagePanel),
  { ssr: false }
);

import { VisualEditorView } from './VisualEditorView';

import { EditorToolbar } from './EditorToolbar';
import { EditorContextMenu } from './EditorContextMenu';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useEditorCollaboration } from '@/features/editor/ui/hooks/use-collaboration';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import type { Page, PageFile } from '@/features/editor/domain/types';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';

export interface EditorPaneProps {
  paneId: 'primary' | 'secondary';
  file?: Page | PageFile | AssetInfo | null;
  projectId?: string;
  rootPageId?: string;
  isActivePane: boolean;
  isSplitActive: boolean;
  availableFiles?: PageFile[];
  onFocusPane?: () => void;
  onSplitRight?: () => void;
  onCloseSplit?: () => void;
  onSwapPanes?: () => void;
  onSelectFile?: (fileId: string) => void;
}

export function EditorPane({
  paneId,
  file,
  projectId = '',
  rootPageId = '',
  isActivePane,
  isSplitActive,
  availableFiles = [],
  onFocusPane,
  onSplitRight,
  onCloseSplit,
  onSwapPanes,
  onSelectFile,
}: EditorPaneProps) {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const showEditorTabs = useSettingsStore((s) => s.showEditorTabs);
  const isLocked = useSettingsStore((s) => s.isLocked);

  const fileId = file?.id;
  const fileName =
    (file && 'title' in file && file.title) ||
    (file && 'filename' in file && file.filename) ||
    'main.tex';
  const mimeType =
    file && 'mimeType' in file && typeof file.mimeType === 'string'
      ? file.mimeType
      : '';
  const isAsset = Boolean(
    (file && 'filename' in file) ||
      (mimeType &&
        !mimeType.startsWith('text/') &&
        !/\.(tex|bib|sty|cls|md|txt)$/i.test(fileName)),
  );

  // Content resolution with LRU cache
  const cachedModel = fileId ? lruDocumentCache.getModel(fileId) : null;
  const fileContent = file && 'content' in file ? (file as { content?: unknown }).content : undefined;
  const rawContent =
    cachedModel?.content !== undefined
      ? cachedModel.content
      : typeof fileContent === 'string'
        ? fileContent
        : typeof fileContent === 'object' && fileContent !== null && 'source' in fileContent
          ? String((fileContent as { source?: unknown }).source ?? '')
          : '';

  // Realtime Yjs collaboration
  const { yText, awareness, status: realtimeStatus } = useEditorCollaboration({
    projectId,
    fileId,
    initialValue: rawContent,
    enabled: Boolean(fileId && projectId && editorMode !== 'visual' && !isAsset),
  });

  const isRealtimeConnected = Boolean(yText) && realtimeStatus === 'connected';

  React.useEffect(() => {
    if (!fileId) return;
    sessionCoordinator.setRealtimeConnected(fileId, isRealtimeConnected);
  }, [fileId, isRealtimeConnected]);

  return (
    <div
      onClick={onFocusPane}
      className={cn(
        'h-full w-full flex flex-col bg-canvas min-h-0 min-w-0 transition-colors duration-150',
        isSplitActive && isActivePane && 'ring-1 ring-primary/40'
      )}
    >
      {/* ── Pane Header ────────────────────────────────────────────────────── */}
      {isSplitActive ? (
        <div className="flex items-center justify-between h-9 px-3 bg-surface border-b border-border shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <SourceVisualSwitcher />
            <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
            <FileCode2 className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
              {fileName}
            </span>
            {cachedModel?.isDirty && (
              <span className="size-1.5 rounded-full bg-primary shrink-0" title="Unsaved changes" />
            )}
            <span className="text-[10px] text-muted-foreground uppercase font-mono font-medium tracking-wider px-1.5 py-0.5 bg-muted/60 rounded">
              {paneId}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onSwapPanes && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapPanes();
                }}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Đổi vị trí 2 khung soạn thảo"
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
            )}
            {onCloseSplit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSplit();
                }}
                className="size-7 text-muted-foreground hover:text-destructive"
                title="Đóng khung soạn thảo này"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : showEditorTabs && fileId ? (
        <Tabs
          rootPageId={rootPageId || projectId}
          activeFileId={fileId}
          availableFiles={availableFiles}
          rightSlot={
            onSplitRight ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onSplitRight();
                }}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Chia đôi khung soạn thảo (Split to Side)"
              >
                <Columns2 className="size-3.5" />
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex items-center justify-between h-9 bg-surface border-b border-border px-2 shrink-0">
          <div className="flex items-center gap-2">
            <SourceVisualSwitcher />
            <span className="text-xs text-muted-foreground">{fileName}</span>
          </div>
          <div className="flex items-center gap-1">
            {onSplitRight && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSplitRight}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Chia đôi khung soạn thảo"
              >
                <Columns2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Editor Body Surface ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col bg-canvas overflow-hidden">
        {isAsset && file ? (
          <ImagePanel
            asset={
              'filename' in file
                ? file
                : {
                    id: file.id,
                    filename: file.title || 'asset',
                    size:
                      'size' in file && typeof file.size === 'number'
                        ? file.size
                        : undefined,
                    mimeType:
                      'mimeType' in file && typeof file.mimeType === 'string'
                        ? file.mimeType
                        : undefined,
                  }
            }
          />
        ) : fileId ? (
          <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col bg-canvas">
            {editorMode === 'visual' && <EditorToolbar readOnly={isLocked} />}
            <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
              {editorMode === 'visual' ? (
                <VisualEditorView
                  fileId={fileId}
                  filePath={fileName}
                  value={rawContent}
                  readOnly={isLocked}
                  onChange={(nextText) => {
                    lruDocumentCache.updateContent(fileId, nextText, true);
                    sessionCoordinator.notifyContentChange(fileId, nextText, {
                      isRealtimeActive: false,
                    });
                  }}
                />
              ) : (
                <EditorContextMenu>
                  <CodeMirrorView
                    fileId={fileId}
                    filePath={fileName}
                    value={rawContent}
                    readOnly={isLocked}
                    yText={yText}
                    awareness={awareness}
                    isRealtimeConnected={isRealtimeConnected}
                    projectId={projectId}
                  />
                </EditorContextMenu>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-4 text-center">
            <p className="text-xs text-muted-foreground">Không có tệp nào được mở trong khung này</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorPane;
