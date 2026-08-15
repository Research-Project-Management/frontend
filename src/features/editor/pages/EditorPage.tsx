'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { TooltipProvider } from '@/shared/components/ui';
import { Skeleton } from '@/shared/components/ui';
import { FileImage, AlertCircle, FileCode2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

import SideBar from '../components/SideBar/Sidebar';
import Toolbar from '../components/layout/Toolbar';
import SettingsPanel from '../components/layout/SettingsPanel';
import TabBar from '../components/Editor/TabBar';

import { PageContextProvider } from '@/features/editor/store/page-context';
import { useEditorSettingsStore } from '@/features/editor/store/editor-settings.store';
import { resolveFileUrl } from '@/features/editor/utils/latex';
import { useLayout } from '@/features/editor/hooks/use-layout';
import type { AssetInfo } from '@/features/editor/store/page-context';

const Editor = dynamic(() => import('../components/Editor/Editor'), { ssr: false });
const Viewer = dynamic(() => import('../components/Viewer/Viewer'), { ssr: false });

// ─── Editor Context ───────────────────────────────────────────────────────────

export const EditorContext = createContext<{
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
}>({ editorRef: { current: null } });

export const useEditorContext = () => useContext(EditorContext);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-px bg-border hover:bg-primary/40 active:bg-primary/60 cursor-col-resize shrink-0 transition-colors relative"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

function ImagePanel({ asset }: { asset: AssetInfo }) {
  const ext = asset.filename.split('.').pop()?.toUpperCase() ?? '';
  const sizeLabel = asset.size
    ? asset.size < 1024
      ? `${asset.size} B`
      : asset.size < 1024 * 1024
        ? `${(asset.size / 1024).toFixed(1)} KB`
        : `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0">
        <FileImage className="size-3.5" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{ext}</span>}
        {sizeLabel && <span>{sizeLabel}</span>}
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {asset.url ? (
          <img
            src={resolveFileUrl(asset.url) || ''}
            alt={asset.filename}
            crossOrigin="use-credentials"
            className="max-w-full max-h-full object-contain rounded shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-6" />
            <span className="text-sm">Image URL not available.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <FileCode2 className="size-10 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">No file open</p>
      <p className="text-xs text-muted-foreground/60">
        Open a file from the Explorer to start editing.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full w-full flex flex-col animate-in fade-in duration-300">
      <div className="h-11 border-b border-border flex items-center gap-2 px-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="h-11 border-b border-border bg-muted/20 flex items-center gap-px px-1">
        {[90, 110, 75].map((w, i) => (
          <Skeleton key={i} className="h-5 rounded" style={{ width: w }} />
        ))}
      </div>
      <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-4 space-y-2">
        {Array.from({ length: 24 }).map((_, i) => {
          const widths = ['60%', '45%', '75%', '30%', '55%', '80%', '40%', '65%', '20%', '70%', '50%', '35%'];
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-8 text-right">
                <Skeleton className="h-3.5 w-5 ml-auto" />
              </span>
              <Skeleton className="h-3.5 rounded-sm" style={{ width: widths[i % widths.length] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Editor Column ────────────────────────────────────────────────────────────

function EditorColumn() {
  const { isLoading, activePage, isAssetTab, displayPage, pageId, fileId, selectedAsset, editorRef } = useLayout();

  if (isLoading) return <LoadingSkeleton />;

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Page not found</p>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ editorRef }}>
      <div className="h-full w-full overflow-hidden flex flex-col">
        {pageId && <TabBar rootPageId={pageId} activeFileId={fileId ?? activePage._id ?? ''} />}
        <div className="flex-1 overflow-hidden">
          {isAssetTab ? (
            <ImagePanel asset={selectedAsset!} />
          ) : displayPage ? (
            <Editor page={displayPage} />
          ) : (
            <EmptyEditorState />
          )}
        </div>
      </div>
    </EditorContext.Provider>
  );
}

// ─── Shell (sidebar + editor + viewer + settings) ─────────────────────────────

function EditorShell() {
  const {
    layout,
    sidebarWidth,
    editorFlex,
    setSidebarWidth,
    setEditorFlex,
    settingsPanelOpen,
    editorTheme,
  } = useEditorSettingsStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const editorFlexRef = useRef(editorFlex);

  const [localSidebarWidth, setLocalSidebarWidth] = useState(sidebarWidth);
  const [localEditorFlex, setLocalEditorFlex] = useState(editorFlex);

  const MIN_SIDEBAR = 300;
  const MAX_SIDEBAR = 420;
  const MIN_EDITOR_FLEX = 0.2;
  const MAX_EDITOR_FLEX = 0.8;

  useEffect(() => {
    if (editorTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [editorTheme]);

  const clampSidebarWidth = useCallback(
    (width: number) => Math.min(Math.max(width, MIN_SIDEBAR), MAX_SIDEBAR),
    [],
  );

  useEffect(() => {
    const clamped = clampSidebarWidth(sidebarWidth);
    sidebarWidthRef.current = clamped;
    setLocalSidebarWidth(clamped);
    if (clamped !== sidebarWidth) setSidebarWidth(clamped);
  }, [clampSidebarWidth, setSidebarWidth, sidebarWidth]);

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const newW = clampSidebarWidth(startWidth + (ev.clientX - startX));
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(sidebarWidthRef.current);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [clampSidebarWidth, setSidebarWidth]);

  const handleEditorViewerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const available = rect.width - sidebarWidthRef.current - 2;
    const onMove = (ev: MouseEvent) => {
      const mouseX = ev.clientX - rect.left - sidebarWidthRef.current - 1;
      const newFlex = Math.min(Math.max(mouseX / available, MIN_EDITOR_FLEX), MAX_EDITOR_FLEX);
      editorFlexRef.current = newFlex;
      setLocalEditorFlex(newFlex);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setEditorFlex(editorFlexRef.current);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const showEditor = layout !== 'viewer-only';
  const showViewer = layout !== 'editor-only';
  const showDivider = layout === 'split';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toolbar />
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <div style={{ width: localSidebarWidth }} className="shrink-0 overflow-hidden">
          <SideBar />
        </div>
        <ResizeHandle onMouseDown={handleSidebarResize} />

        {showEditor && (
          <div style={{ flex: showDivider ? localEditorFlex : 1 }} className="min-w-0 overflow-hidden">
            <EditorColumn />
          </div>
        )}

        {showDivider && <ResizeHandle onMouseDown={handleEditorViewerResize} />}

        <div
          style={{ flex: showDivider ? 1 - localEditorFlex : 1, display: showViewer ? undefined : 'none' }}
          className="min-w-0 overflow-hidden"
        >
          <Viewer />
        </div>

        {settingsPanelOpen && <SettingsPanel />}
      </div>
    </div>
  );
}

// ─── EditorPage (entry point exported to app/ routing) ───────────────────────

export function EditorPage() {
  return (
    <TooltipProvider delayDuration={200}>
      <PageContextProvider>
        <EditorShell />
      </PageContextProvider>
    </TooltipProvider>
  );
}
