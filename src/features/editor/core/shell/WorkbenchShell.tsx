/**
 * WorkbenchShell.tsx
 *
 * Canonical Overleaf-Parity Workbench Shell (Block 7: UI Shell Layer).
 * Location: `features/editor/core/shell/WorkbenchShell.tsx`
 *
 * Slots & Anatomy:
 * 1. TopBarSlot: Global project metadata & menu bar.
 * 2. ActivityBarSlot: Far-left 48px icon strip to toggle Primary Sidebar viewlets (Files, Search, Citations, Review, AI).
 * 3. LeftSidebarSlot: Primary Sidebar Viewlet Container (Files + File Outline, Search, Citations, Review, AI).
 * 4. EditorSlot: Scoped EditorTabBar + Scoped EditorToolbar + CodeMirror / Visual Editor View.
 * 5. PreviewSlot: Scoped PdfToolbar + PDF.js Canvas Scroller & CompilerLogs.
 * 6. CenterSplitter: Smooth resizable divider between Editor and Preview.
 *
 * State & Sizing: Fully managed by `useWorkspaceStore`.
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/features/editor/core';
import { ResizeHandle } from './ResizeHandle';
import { OfflineBanner } from './OfflineBanner';
import { cn } from '@/shared/lib/utils';

export interface WorkbenchShellProps {
  topBar?: React.ReactNode;
  activityBar?: React.ReactNode;
  leftSidebar?: React.ReactNode;
  editor?: React.ReactNode;
  preview?: React.ReactNode;
  className?: string;
}

export function WorkbenchShell({
  topBar,
  activityBar,
  leftSidebar,
  editor,
  preview,
  className,
}: WorkbenchShellProps) {
  const {
    sidebarLeftOpen,
    sidebarLeftWidth,
    setSidebarLeftWidth,
    toggleSidebarLeft,
    splitRatio,
    setSplitRatio,
  } = useWorkspaceStore(
    useShallow((s) => ({
      sidebarLeftOpen: s.sidebarLeftOpen,
      sidebarLeftWidth: s.sidebarLeftWidth,
      setSidebarLeftWidth: s.setSidebarLeftWidth,
      toggleSidebarLeft: s.toggleSidebarLeft,
      splitRatio: s.splitRatio,
      setSplitRatio: s.setSplitRatio,
    }))
  );

  const [isPreviewCollapsed, setIsPreviewCollapsed] = React.useState(false);
  const togglePreviewCollapse = useCallback(() => {
    setIsPreviewCollapsed((prev) => !prev);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Drag Handler for Left Sidebar (Mouse & Touch)
  const handleLeftSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarLeftWidth;
    let rafId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const delta = moveEvent.clientX - startX;
        setSidebarLeftWidth(startWidth + delta);
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarLeftWidth, setSidebarLeftWidth]);

  const handleLeftSidebarTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const startX = e.touches[0].clientX;
    const startWidth = sidebarLeftWidth;
    let rafId: number | null = null;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const delta = moveEvent.touches[0].clientX - startX;
        setSidebarLeftWidth(startWidth + delta);
      });
    };

    const onTouchEnd = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }, [sidebarLeftWidth, setSidebarLeftWidth]);

  // 2. Drag Handler for Center Editor vs Preview Split (Mouse & Touch)
  const handleCenterSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width;
    let rafId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const relativeX = moveEvent.clientX - rect.left;
        const ratio = relativeX / totalWidth;
        setSplitRatio(ratio);
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setSplitRatio]);

  const handleCenterSplitTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width;
    let rafId: number | null = null;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const relativeX = moveEvent.touches[0].clientX - rect.left;
        const ratio = relativeX / totalWidth;
        setSplitRatio(ratio);
      });
    };

    const onTouchEnd = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }, [setSplitRatio]);

  return (
    <div className={cn('h-screen w-screen flex flex-col bg-background select-none', className)}>
      {/* ── Slot 1: Global Topbar ─────────────────────────────────────────── */}
      {topBar && <header className="shrink-0 z-30">{topBar}</header>}

      {/* ── Offline Connectivity Banner ─────────────────────────────────── */}
      <OfflineBanner />

      {/* ── Core Workspace (Horizontal Shell Area) ────────────────────────── */}
      <main className="flex-1 flex relative min-h-0 overflow-hidden">
        {/* ── Slot 2: Far-Left Activity Bar (Icon Strip) ──────────────────── */}
        {activityBar && (
          <div className="h-full shrink-0 z-20">
            {activityBar}
          </div>
        )}

        {/* ── Slot 3: Left Primary Sidebar & Overleaf Splitter ─────────────── */}
        {leftSidebar && (
          <>
            {sidebarLeftOpen && (
              <aside
                style={{ width: `${sidebarLeftWidth}px` }}
                className="h-full shrink-0 flex flex-col bg-surface overflow-hidden z-20"
              >
                {leftSidebar}
              </aside>
            )}
            <ResizeHandle
              onMouseDown={sidebarLeftOpen ? handleLeftSidebarResize : () => {}}
              onTouchStart={sidebarLeftOpen ? handleLeftSidebarTouchStart : () => {}}
              label={sidebarLeftOpen ? 'Resize or collapse left sidebar' : 'Expand left sidebar'}
              showCollapseButton
              isCollapsed={!sidebarLeftOpen}
              onToggleCollapse={toggleSidebarLeft}
              collapseDirection="left"
              showGripDots={sidebarLeftOpen}
            />
          </>
        )}

        {/* ── Center Work Area: Editor & PDF Preview ──────────────────────── */}
        <div ref={containerRef} className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 flex min-h-0 min-w-0">
            {/* ── Slot 4: Center Editor Area ────────────────────────────────── */}
            <section
              style={{ flex: isPreviewCollapsed ? '1 1 0%' : `${splitRatio} 1 0%` }}
              className="h-full flex flex-col min-w-0 sm:min-w-[200px] min-h-0 bg-canvas relative"
            >
              {editor}
            </section>

            {/* ── Slot 6: Center Splitter Handle between Editor and Preview ─── */}
            {preview && (
              <ResizeHandle
                onMouseDown={isPreviewCollapsed ? () => {} : handleCenterSplitResize}
                onTouchStart={isPreviewCollapsed ? () => {} : handleCenterSplitTouchStart}
                onDoubleClick={() => {
                  setIsPreviewCollapsed(false);
                  setSplitRatio(0.5);
                }}
                label={isPreviewCollapsed ? 'Expand PDF preview' : 'Resize or collapse PDF preview'}
                showCollapseButton
                isCollapsed={isPreviewCollapsed}
                onToggleCollapse={togglePreviewCollapse}
                collapseDirection="right"
                showGripDots={!isPreviewCollapsed}
              />
            )}

            {/* ── Slot 5: Right Document Preview Area ───────────────────────── */}
            {preview && !isPreviewCollapsed && (
              <section
                style={{ flex: `${1 - splitRatio} 1 0%` }}
                className="h-full flex flex-col min-w-0 sm:min-w-[200px] min-h-0 bg-canvas relative"
              >
                {preview}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default WorkbenchShell;
