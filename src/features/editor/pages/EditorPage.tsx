'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { TooltipProvider } from '@/shared/components/ui';
import { Skeleton } from '@/shared/components/ui';
import { FileImage, AlertCircle, FileCode2, LayoutGrid } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

import SideBar, { type SidebarTab } from '../components/sidebar/Sidebar';
import Topbar from '../components/topbar/Topbar';
import Setting from '../components/topbar/settings/Setting';
import Tabs from '../components/editor/Tabs';

import { useSettingsStore } from '@/features/editor/store/settings.store';
import { resolveFileUrl } from '@/features/editor/utils/editor.util';
import { useActiveDocument } from '@/features/editor/hooks/use-page';
import type { AssetInfo } from '@/features/editor/store/page.store';
import { cn } from '@/shared/lib/utils';

const Editor = dynamic(() => import('../components/editor/Editor'), { ssr: false });
const Viewer = dynamic(() => import('../components/viewer/Viewer'), { ssr: false });

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onDoubleClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  isDragging?: boolean;
  label?: string;
}

function ResizeHandle({
  onMouseDown,
  onTouchStart,
  onDoubleClick,
  onKeyDown,
  isDragging = false,
  label = "Resize pane",
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative w-1 bg-border/60 hover:bg-primary/50 active:bg-primary cursor-col-resize shrink-0 transition-all duration-150 outline-none",
        "focus-visible:ring-1 focus-visible:ring-primary select-none",
        isDragging && "bg-primary w-1 shadow-xs"
      )}
    >
      {/* Expanded invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />

      {/* Optical grip pill in center */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-all duration-150",
          isDragging
            ? "opacity-100 scale-110"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
      >
        <span className="h-6 w-1 rounded-full bg-primary shadow-xs" />
      </div>
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0 bg-secondary/30">
        <FileImage className="size-3.5 text-primary" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && <span className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px] text-muted-foreground">{ext}</span>}
        {sizeLabel && <span className="text-[11px] text-muted-foreground/70">{sizeLabel}</span>}
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-muted/20">
        {asset.url ? (
          <img
            src={resolveFileUrl(asset.url) || ''}
            alt={asset.filename}
            crossOrigin="use-credentials"
            className="max-w-full max-h-full object-contain rounded-md shadow-sm border border-border/40"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-6 text-muted-foreground/60" />
            <span className="text-sm">Image URL not available.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none bg-background">
      <div className="size-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center">
        <FileCode2 className="size-7 text-muted-foreground/50" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">No file open</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Select a document from the Files explorer or create a new file to start writing.
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full w-full flex flex-col bg-background animate-in fade-in duration-300">
      <div className="h-10 border-b border-border bg-secondary/40 flex items-center gap-2 px-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="h-10 border-b border-border bg-muted/20 flex items-center gap-px px-2">
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

// ─── Editor Column ────────────────────────────────────────────────────────────

function EditorColumn() {
  const { isLoading, activePage, isAssetTab, displayPage, pageId, fileId, selectedAsset } = useActiveDocument();

  if (isLoading) return <LoadingSkeleton />;

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground text-sm">Page not found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-background">
      {pageId && <Tabs rootPageId={pageId} activeFileId={fileId ?? activePage._id ?? ''} />}
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
  } = useSettingsStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const editorFlexRef = useRef(editorFlex);

  const [localSidebarWidth, setLocalSidebarWidth] = useState(sidebarWidth);
  const [localEditorFlex, setLocalEditorFlex] = useState(editorFlex);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarTab | null>("Files");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  const isSidebarCollapsed = !activeSidebarPanel;

  const DEFAULT_SIDEBAR = 300;
  const MIN_SIDEBAR = 240;
  const MAX_SIDEBAR = 440;
  const MIN_EDITOR_FLEX = 0.2;
  const MAX_EDITOR_FLEX = 0.8;

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (editorTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [editorTheme]);

  const clampSidebarWidth = useCallback(
    (width: number) => Math.min(Math.max(width, MIN_SIDEBAR), MAX_SIDEBAR),
    [MIN_SIDEBAR, MAX_SIDEBAR],
  );

  useEffect(() => {
    const clamped = clampSidebarWidth(sidebarWidth);
    sidebarWidthRef.current = clamped;
    setLocalSidebarWidth(clamped);
    if (clamped !== sidebarWidth) setSidebarWidth(clamped);
  }, [clampSidebarWidth, setSidebarWidth, sidebarWidth]);

  // Sidebar resize (Mouse & Touch)
  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      const newW = clampSidebarWidth(startWidth + (ev.clientX - startX));
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
    };

    const onUp = () => {
      setIsDraggingSidebar(false);
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

  const handleSidebarTouchResize = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDraggingSidebar(true);
    const startX = touch.clientX;
    const startWidth = sidebarWidthRef.current;

    const onTouchMove = (ev: TouchEvent) => {
      const currentTouch = ev.touches[0];
      if (!currentTouch) return;
      const newW = clampSidebarWidth(startWidth + (currentTouch.clientX - startX));
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
    };

    const onTouchEnd = () => {
      setIsDraggingSidebar(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      setSidebarWidth(sidebarWidthRef.current);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  }, [clampSidebarWidth, setSidebarWidth]);

  const handleSidebarReset = useCallback(() => {
    sidebarWidthRef.current = DEFAULT_SIDEBAR;
    setLocalSidebarWidth(DEFAULT_SIDEBAR);
    setSidebarWidth(DEFAULT_SIDEBAR);
  }, [DEFAULT_SIDEBAR, setSidebarWidth]);

  const handleSidebarKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newW = clampSidebarWidth(sidebarWidthRef.current + 20);
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
      setSidebarWidth(newW);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newW = clampSidebarWidth(sidebarWidthRef.current - 20);
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
      setSidebarWidth(newW);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleSidebarReset();
    }
  }, [clampSidebarWidth, setSidebarWidth, handleSidebarReset]);

  // Editor-Viewer Splitter Resize (Mouse & Touch)
  const handleEditorViewerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setIsDraggingSplitter(true);

    const rect = container.getBoundingClientRect();
    const available = rect.width - sidebarWidthRef.current - 4;

    const onMove = (ev: MouseEvent) => {
      const mouseX = ev.clientX - rect.left - sidebarWidthRef.current - 2;
      const newFlex = Math.min(Math.max(mouseX / available, MIN_EDITOR_FLEX), MAX_EDITOR_FLEX);
      editorFlexRef.current = newFlex;
      setLocalEditorFlex(newFlex);
    };

    const onUp = () => {
      setIsDraggingSplitter(false);
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
  }, [MIN_EDITOR_FLEX, MAX_EDITOR_FLEX, setEditorFlex]);

  const handleEditorViewerTouchResize = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const touch = e.touches[0];
    if (!touch) return;
    setIsDraggingSplitter(true);

    const rect = container.getBoundingClientRect();
    const available = rect.width - sidebarWidthRef.current - 4;

    const onTouchMove = (ev: TouchEvent) => {
      const currentTouch = ev.touches[0];
      if (!currentTouch) return;
      const touchX = currentTouch.clientX - rect.left - sidebarWidthRef.current - 2;
      const newFlex = Math.min(Math.max(touchX / available, MIN_EDITOR_FLEX), MAX_EDITOR_FLEX);
      editorFlexRef.current = newFlex;
      setLocalEditorFlex(newFlex);
    };

    const onTouchEnd = () => {
      setIsDraggingSplitter(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      setEditorFlex(editorFlexRef.current);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  }, [MIN_EDITOR_FLEX, MAX_EDITOR_FLEX, setEditorFlex]);

  const handleSplitterReset = useCallback(() => {
    editorFlexRef.current = 0.5;
    setLocalEditorFlex(0.5);
    setEditorFlex(0.5);
  }, [setEditorFlex]);

  const handleEditorViewerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = Math.min(MAX_EDITOR_FLEX, editorFlexRef.current + 0.05);
      editorFlexRef.current = next;
      setLocalEditorFlex(next);
      setEditorFlex(next);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(MIN_EDITOR_FLEX, editorFlexRef.current - 0.05);
      editorFlexRef.current = next;
      setLocalEditorFlex(next);
      setEditorFlex(next);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleSplitterReset();
    }
  }, [MIN_EDITOR_FLEX, MAX_EDITOR_FLEX, setEditorFlex, handleSplitterReset]);

  const showEditor = layout !== 'viewer-only';
  const showViewer = layout !== 'editor-only';
  const showDivider = layout === 'split' && !isNarrowScreen;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Topbar />
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div
          style={{ width: isNarrowScreen ? '100%' : (isSidebarCollapsed ? 52 : localSidebarWidth) }}
          className={cn(
            "shrink-0 overflow-hidden bg-card border-r border-border/40 transition-all duration-200 ease-out",
            isNarrowScreen && "hidden",
            isDraggingSidebar && "transition-none"
          )}
        >
          <SideBar activePanel={activeSidebarPanel} onActivePanelChange={setActiveSidebarPanel} />
        </div>

        {/* Sidebar <-> Editor Splitter */}
        {!isNarrowScreen && !isSidebarCollapsed && (
          <ResizeHandle
            onMouseDown={handleSidebarResize}
            onTouchStart={handleSidebarTouchResize}
            onDoubleClick={handleSidebarReset}
            onKeyDown={handleSidebarKeyDown}
            isDragging={isDraggingSidebar}
            label="Resize sidebar pane (Double-click to reset)"
          />
        )}

        {/* Editor Column */}
        {showEditor && (
          <div
            style={{ flex: showDivider ? localEditorFlex : 1 }}
            className={cn(
              "min-w-0 overflow-hidden bg-background",
              isDraggingSplitter && "transition-none"
            )}
          >
            <EditorColumn />
          </div>
        )}

        {/* Editor <-> Viewer Splitter */}
        {showDivider && (
          <ResizeHandle
            onMouseDown={handleEditorViewerResize}
            onTouchStart={handleEditorViewerTouchResize}
            onDoubleClick={handleSplitterReset}
            onKeyDown={handleEditorViewerKeyDown}
            isDragging={isDraggingSplitter}
            label="Resize editor and PDF preview panes (Double-click to reset 50/50)"
          />
        )}

        {/* PDF Viewer Column */}
        <div
          style={{
            flex: showDivider ? 1 - localEditorFlex : 1,
            display: showViewer ? undefined : 'none'
          }}
          className={cn(
            "min-w-0 overflow-hidden bg-muted/20 dark:bg-zinc-950/60 border-l border-border/40",
            isDraggingSplitter && "transition-none"
          )}
        >
          <Viewer />
        </div>

        {/* Settings Panel */}
        {settingsPanelOpen && <Setting />}
      </div>
    </div>
  );
}

// ─── EditorPage (entry point exported to app/ routing) ───────────────────────

export function EditorPage() {
  return (
    <TooltipProvider delayDuration={200}>
      <EditorShell />
    </TooltipProvider>
  );
}
export default EditorPage;
