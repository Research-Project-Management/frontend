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
import { PlaneEmptyState, Button } from '@/shared/components/ui';

import Tabs from './EditorTabs';
import { EditorBreadcrumbs } from './EditorBreadcrumbs';
import { ImagePanel } from './ImagePanel';
import { CodeMirrorView } from './CodeMirrorView';
import { EditorToolbar } from './EditorToolbar';

import { useActiveDocument } from '../../../hooks/use-core';
import { useSettingsStore } from '../../../store/settings.store';
import { usePageStore } from '../../../store/editor.store';

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
    <div className="h-full w-full flex flex-col bg-canvas animate-in fade-in duration-300">
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

  const handleOpenDefault = React.useCallback(() => {
    if (pageId) {
      selectFile(pageId);
    }
  }, [pageId, selectFile]);

  if (isLoading) return <LoadingSkeleton />;

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full bg-canvas">
        <p className="text-muted-foreground text-sm">Page not found</p>
      </div>
    );
  }

  const rawContent =
    displayPage?.content != null
      ? typeof displayPage.content === 'string'
        ? displayPage.content
        : (displayPage.content as any).source || ''
      : '';

  return (
    <div className="h-full w-full flex flex-col bg-canvas min-h-0">
      {/* ── Multi-file Tabs Header ────────────────────────────────────────── */}
      {showEditorTabs && pageId && (
        <Tabs
          rootPageId={pageId}
          activeFileId={fileId ?? activePage.id ?? ''}
          availableFiles={childFiles}
        />
      )}

      {/* ── Breadcrumb Navigation ─────────────────────────────────────────── */}
      <EditorBreadcrumbs
        projectTitle={parentPage?.title || activePage?.title || 'Project'}
        fileName={displayPage?.title || activePage?.title || 'main.tex'}
        onNavigateRoot={handleOpenDefault}
      />

      {/* ── Core Editor Body ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col overflow-hidden">
        {isAssetTab ? (
          <ImagePanel asset={selectedAsset!} />
        ) : displayPage ? (
          <div className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col overflow-hidden bg-background">
            <EditorToolbar />
            <div className="flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
              <CodeMirrorView
                fileId={displayPage.id}
                filePath={displayPage.title || 'main.tex'}
                value={rawContent}
                onChange={(nextText) => {
                  usePageStore.getState().setCurrentPage((prev: any) =>
                    prev ? { ...prev, content: nextText } : prev
                  );
                }}
              />
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
