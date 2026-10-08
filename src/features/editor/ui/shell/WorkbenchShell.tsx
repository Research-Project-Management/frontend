/**
 * WorkbenchShell.tsx
 *
 * Canonical Workbench Shell (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/WorkbenchShell.tsx`
 *
 * Slots & Anatomy:
 * 1. TopBarSlot: Global project metadata & compilation triggers.
 * 2. ActivityBarSlot: Far-left 48px icon strip to toggle Primary Sidebar viewlets (Files, Search, AI...).
 * 3. LeftSidebarSlot: Primary Sidebar Viewlet Container (Files, Outline, Search, Citations, Review, Chat, AI).
 * 4. EditorSlot: Scoped EditorTabBar + Breadcrumbs + Scoped EditorToolbar + CodeMirror View.
 * 5. PreviewSlot: Scoped PdfToolbar + PDF.js Canvas Scroller.
 * 6. CenterSplitter: Smooth resizable divider between Editor and Preview.
 * 7. BottomPanelSlot: Dockable Problems View & Raw Compiler Log terminal.
 * 8. StatusBarSlot: Interactive footer strip (Vim, Ln:Col, Git branch, Error badges).
 *
 * State & Sizing: Fully managed by `useLayoutStore`.
 * NOTE: AI Assistant is integrated directly into the Left Primary Sidebar.
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { useLayoutStore } from '../../store/layout.store';
import { ResizeHandle } from './ResizeHandle';
import { cn } from '@/shared/lib/utils';

export interface WorkbenchShellProps {
  topBar?: React.ReactNode;
  activityBar?: React.ReactNode;
  leftSidebar?: React.ReactNode;
  editor?: React.ReactNode;
  preview?: React.ReactNode;
  bottomPanel?: React.ReactNode;
  statusBar?: React.ReactNode;
  className?: string;
}

export function WorkbenchShell({
  topBar,
  activityBar,
  leftSidebar,
  editor,
  preview,
  bottomPanel,
  statusBar,
  className,
}: WorkbenchShellProps) {
  const {
    sidebarLeftOpen,
    sidebarLeftWidth,
    setSidebarLeftWidth,
    splitRatio,
    setSplitRatio,
    bottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
    statusBarOpen,
  } = useLayoutStore();

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Drag Handler for Left Sidebar
  const handleLeftSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarLeftWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarLeftWidth(startWidth + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarLeftWidth, setSidebarLeftWidth]);

  // 2. Drag Handler for Center Editor vs Preview Split
  const handleCenterSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - rect.left;
      const ratio = relativeX / totalWidth;
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setSplitRatio]);

  // 3. Drag Handler for Bottom Diagnostics / Problems Panel
  const handleBottomPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setBottomPanelHeight(startHeight + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [bottomPanelHeight, setBottomPanelHeight]);

  return (
    <div className={cn('h-screen w-screen flex flex-col bg-background select-none', className)}>
      {/* ── Slot 1: Global Topbar ─────────────────────────────────────────── */}
      {topBar && <header className="shrink-0 z-30">{topBar}</header>}

      {/* ── Core Workspace (Horizontal Shell Area) ────────────────────────── */}
      <main className="flex-1 flex relative min-h-0">
        {/* ── Slot 2: Far-Left Activity Bar (Icon Strip) ──────────────────── */}
        {activityBar && (
          <div className="h-full shrink-0 z-20">
            {activityBar}
          </div>
        )}

        {/* ── Slot 3: Left Primary Sidebar ────────────────────────────────── */}
        {sidebarLeftOpen && leftSidebar && (
          <>
            <aside
              style={{ width: `${sidebarLeftWidth}px` }}
              className="h-full shrink-0 flex flex-col border-r border-border bg-surface overflow-hidden z-20"
            >
              {leftSidebar}
            </aside>
            <ResizeHandle
              onMouseDown={handleLeftSidebarResize}
              onTouchStart={() => {}}
              label="Resize left sidebar"
            />
          </>
        )}

        {/* ── Center Work Area: Editor, Preview, and Bottom Panel ──────────── */}
        <div ref={containerRef} className="flex-1 flex flex-col h-full min-w-0 min-h-0">
          <div className="flex-1 flex min-h-0 min-w-0">
            {/* ── Slot 4: Center Editor Area ────────────────────────────────── */}
            <section
              style={{ flex: `${splitRatio} 1 0%` }}
              className="h-full flex flex-col min-w-[200px] min-h-0 bg-canvas relative"
            >
              {editor}
            </section>

            {/* ── Slot 6: Center Splitter Handle between Editor and Preview ─── */}
            {preview && (
              <ResizeHandle
                onMouseDown={handleCenterSplitResize}
                onTouchStart={() => {}}
                label="Resize editor and preview panes"
              />
            )}

            {/* ── Slot 5: Right Document Preview Area ───────────────────────── */}
            {preview && (
              <section
                style={{ flex: `${1 - splitRatio} 1 0%` }}
                className="h-full flex flex-col min-w-[200px] min-h-0 border-l border-border bg-canvas relative"
              >
                {preview}
              </section>
            )}
          </div>

          {/* ── Slot 7: Bottom Problems & Compiler Logs Drawer ─────────────── */}
          {bottomPanelOpen && bottomPanel && (
            <>
              <ResizeHandle
                onMouseDown={handleBottomPanelResize}
                onTouchStart={() => {}}
                orientation="horizontal"
                label="Resize bottom problems panel"
              />
              <div
                style={{ height: `${bottomPanelHeight}px` }}
                className="shrink-0 border-t border-border bg-surface overflow-hidden"
              >
                {bottomPanel}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Slot 8: Global Status Bar ─────────────────────────────────────── */}
      {statusBarOpen && statusBar && (
        <footer className="shrink-0 z-30">{statusBar}</footer>
      )}
    </div>
  );
}

export default WorkbenchShell;
