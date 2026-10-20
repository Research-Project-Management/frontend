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
import { ArrowLeftRight, X, FileCode2, ChevronDown, Check, Columns2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import dynamic from 'next/dynamic';
import Tabs from './EditorTabs';
import { CodeMirrorView } from './CodeMirrorView';

const ImagePanel = dynamic(
  () => import('./ImagePanel').then((m) => m.ImagePanel),
  { ssr: false }
);

import { EditorToolbar } from './EditorToolbar';
import { EditorContextMenu } from './EditorContextMenu';
import { useSettingsStore, sessionCoordinator } from '@/features/editor/core';
import { useEditorCollaboration } from '@/features/editor/ui/hooks/useCollaboration';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer';
import { extractDocumentContentString, type Page, type PageFile } from '@/features/editor/domain/types/core.types';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';

export interface EditorPaneFileItem {
  id: string;
  title?: string;
  filename?: string;
  name?: string;
}

export interface EditorPaneProps {
  paneId: 'primary' | 'secondary';
  file?: Page | PageFile | AssetInfo | null;
  projectId?: string;
  rootPageId?: string;
  isActivePane: boolean;
  isSplitActive: boolean;
  availableFiles?: EditorPaneFileItem[];
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
  const fallbackContent = extractDocumentContentString(fileContent);
  const rawContent =
    cachedModel?.content !== undefined && (cachedModel.content.length > 0 || !fallbackContent)
      ? cachedModel.content
      : fallbackContent;

  // Realtime Yjs collaboration
  const { yText, awareness, status: realtimeStatus } = useEditorCollaboration({
    projectId,
    fileId,
    initialValue: rawContent,
    enabled: Boolean(fileId && projectId && !isAsset),
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
            {/* Document Switcher Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-sm hover:bg-muted text-xs font-medium text-foreground truncate max-w-[200px] outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer group"
                  aria-label="Switch file"
                >
                  <FileCode2 className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">{fileName}</span>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto z-50">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Project files</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableFiles.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No other files</div>
                ) : (
                  availableFiles.map((f) => {
                    const title = f.title || f.filename || f.name || f.id;
                    const isCurrent = f.id === fileId;
                    return (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => onSelectFile?.(f.id)}
                        className={cn(
                          'flex items-center justify-between gap-2 text-xs cursor-pointer',
                          isCurrent && 'font-semibold text-primary'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{title}</span>
                        </div>
                        {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>

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
                title="Swap split panes"
                aria-label="Swap split panes"
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
                title="Close split pane"
                aria-label="Close split pane"
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
          availableFiles={availableFiles as { id: string; title: string }[] | undefined}
          rightSlot={
            onSplitRight && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSplitRight}
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Split editor right"
                aria-label="Split editor right"
              >
                <Columns2 className="size-3.5" />
              </Button>
            )
          }
        />
      ) : !showEditorTabs && fileId ? (
        <div className="flex items-center h-8 bg-surface border-b border-border px-3 shrink-0 gap-2">
          <span className="text-xs font-medium text-muted-foreground">{fileName}</span>
        </div>
      ) : null}

      {/* ── Editor Body Surface ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col bg-canvas overflow-hidden">
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
          <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col bg-canvas overflow-hidden">
            <EditorToolbar readOnly={isLocked} onSplitRight={onSplitRight} />
            <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
              <EditorContextMenu>
                <CodeMirrorView
                  key={paneId || 'primary'}
                  fileId={fileId}
                  filePath={fileName}
                  value={rawContent}
                  readOnly={isLocked}
                  yText={yText}
                  awareness={awareness}
                  isRealtimeConnected={isRealtimeConnected}
                  projectId={projectId}
                  isActive={isActivePane}
                />
              </EditorContextMenu>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-4 text-center">
            <p className="text-xs text-muted-foreground">No file open in this pane</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorPane;
