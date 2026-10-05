'use client';

/**
 * EditorWorkspaceLayout.tsx
 *
 * 3-Pane Cockpit Shell:
 * - Collapsible / Draggable Sidebar with accessible resize separator
 * - Responsive Editor <-> PDF Viewer split layout with dual mouse/touch dragger
 * - Mobile drawer & quick tab toggle for narrow viewports (< 768px)
 * - Settings drawer and presentation integration
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

import SideBar, { type SidebarTab } from '../../../components/sidebar/SideBar';
import Topbar from '../../../components/topbar/Topbar';
const Setting = dynamic(() => import('../../../components/topbar/settings/Setting'), { ssr: false });
import { ResizeHandle } from './ResizeHandle';
import { EditorColumn } from './EditorColumn';

import { useShallow } from 'zustand/react/shallow';
import { usePageStore, useSettingsStore } from '../../../store';
import { EditorEventBus } from '../../../utils/editor.util';
import { useCollaborationStream } from '../../../hooks/use-collaboration';
import { useEditorInstance } from '../../../core/context/editor-instance.context';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/shared/providers';

const Viewer = dynamic(() => import('../../../components/viewer/Viewer'), { ssr: false });
const HistoryView = dynamic(() => import('../../../components/history/HistoryView'), { ssr: false });

export function EditorWorkspaceLayout() {
  const { projectId: routeProjectId, pageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();
  const storeProjectId = usePageStore((s) => s.projectId);
  const projectId = routeProjectId || storeProjectId || undefined;
  const rootPageId = pageId ?? draftId ?? null;

  // Stream real-time SSE events for the root document (suggestions, comments, page updates)
  useCollaborationStream(projectId ?? null, rootPageId);

  const { resolvedTheme } = useTheme();
  const { engine } = useEditorInstance();

  const {
    layout,
    setLayout,
    sidebarWidth,
    editorFlex,
    setSidebarWidth,
    setEditorFlex,
    settingsPanelOpen,
    editorTheme,
    setEditorTheme,
    isHistoryOpen,
    activeSidebarPanel,
    setActiveSidebarPanel,
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      setLayout: s.setLayout,
      sidebarWidth: s.sidebarWidth,
      editorFlex: s.editorFlex,
      setSidebarWidth: s.setSidebarWidth,
      setEditorFlex: s.setEditorFlex,
      settingsPanelOpen: s.settingsPanelOpen,
      editorTheme: s.editorTheme,
      setEditorTheme: s.setEditorTheme,
      isHistoryOpen: s.isHistoryOpen,
      activeSidebarPanel: s.activeSidebarPanel,
      setActiveSidebarPanel: s.setActiveSidebarPanel,
    }))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const editorFlexRef = useRef(editorFlex);

  const [localSidebarWidth, setLocalSidebarWidth] = useState(sidebarWidth);
  const [localEditorFlex, setLocalEditorFlex] = useState(editorFlex);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  // Smooth drag tracking refs & requestAnimationFrame throttles
  const isDraggingSidebarRef = useRef(false);
  const isDraggingSplitterRef = useRef(false);
  const sidebarRafRef = useRef<number | null>(null);
  const splitterRafRef = useRef<number | null>(null);
  const dragStartSidebarPosRef = useRef({ x: 0, y: 0 });
  const dragStartSplitterPosRef = useRef({ x: 0, y: 0 });
  const sidebarDragDistanceRef = useRef(0);
  const splitterDragDistanceRef = useRef(0);

  const isSidebarCollapsed = !activeSidebarPanel;
  const lastActiveSidebarPanelRef = useRef<SidebarTab>('Files');

  useEffect(() => {
    return () => {
      if (splitterRafRef.current !== null) {
        cancelAnimationFrame(splitterRafRef.current);
      }
      if (sidebarRafRef.current !== null) {
        cancelAnimationFrame(sidebarRafRef.current);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    if (activeSidebarPanel) {
      lastActiveSidebarPanelRef.current = activeSidebarPanel;
    }
  }, [activeSidebarPanel]);

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
    if (resolvedTheme && (editorTheme === 'light' || editorTheme === 'dark')) {
      if (editorTheme !== resolvedTheme) {
        setEditorTheme(resolvedTheme);
      }
    }
  }, [resolvedTheme, editorTheme, setEditorTheme]);

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

  // Sidebar resize (Mouse & Touch) with RAF throttling & drag threshold
  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    dragStartSidebarPosRef.current = { x: startX, y: startY };
    sidebarDragDistanceRef.current = 0;
    const startWidth = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      const dist = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
      sidebarDragDistanceRef.current = dist;

      if (dist > 3 && !isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = true;
        setIsDraggingSidebar(true);
      }

      if (isDraggingSidebarRef.current) {
        if (sidebarRafRef.current !== null) return;
        sidebarRafRef.current = requestAnimationFrame(() => {
          sidebarRafRef.current = null;
          const newW = clampSidebarWidth(startWidth + (ev.clientX - startX));
          sidebarWidthRef.current = newW;
          setLocalSidebarWidth(newW);
        });
      }
    };

    const onUp = () => {
      if (sidebarRafRef.current !== null) {
        cancelAnimationFrame(sidebarRafRef.current);
        sidebarRafRef.current = null;
      }
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = false;
        setIsDraggingSidebar(false);
        setSidebarWidth(sidebarWidthRef.current);
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [clampSidebarWidth, setSidebarWidth]);

  const handleSidebarTouchResize = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const startX = touch.clientX;
    const startY = touch.clientY;
    dragStartSidebarPosRef.current = { x: startX, y: startY };
    sidebarDragDistanceRef.current = 0;
    const startWidth = sidebarWidthRef.current;

    const onTouchMove = (ev: TouchEvent) => {
      const currentTouch = ev.touches[0];
      if (!currentTouch) return;
      const dist = Math.abs(currentTouch.clientX - startX) + Math.abs(currentTouch.clientY - startY);
      sidebarDragDistanceRef.current = dist;

      if (dist > 3 && !isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = true;
        setIsDraggingSidebar(true);
      }

      if (isDraggingSidebarRef.current) {
        if (sidebarRafRef.current !== null) return;
        sidebarRafRef.current = requestAnimationFrame(() => {
          sidebarRafRef.current = null;
          const newW = clampSidebarWidth(startWidth + (currentTouch.clientX - startX));
          sidebarWidthRef.current = newW;
          setLocalSidebarWidth(newW);
        });
      }
    };

    const onTouchEnd = () => {
      if (sidebarRafRef.current !== null) {
        cancelAnimationFrame(sidebarRafRef.current);
        sidebarRafRef.current = null;
      }
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = false;
        setIsDraggingSidebar(false);
        setSidebarWidth(sidebarWidthRef.current);
      }
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  }, [clampSidebarWidth, setSidebarWidth]);

  const handleToggleSidebar = useCallback((e: React.MouseEvent) => {
    if (sidebarDragDistanceRef.current > 3) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (activeSidebarPanel) {
      lastActiveSidebarPanelRef.current = activeSidebarPanel;
    }
    setActiveSidebarPanel(null);
  }, [activeSidebarPanel, setActiveSidebarPanel]);

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

  // Editor-Viewer Splitter Resize (Mouse & Touch) with RAF throttling & drag threshold
  const handleEditorViewerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startX = e.clientX;
    const startY = e.clientY;
    dragStartSplitterPosRef.current = { x: startX, y: startY };
    splitterDragDistanceRef.current = 0;

    const rect = container.getBoundingClientRect();
    const currentSidebarWidth = isSidebarCollapsed ? 44 : sidebarWidthRef.current;
    const editorLeft = rect.left + currentSidebarWidth + 8;
    const available = rect.width - (currentSidebarWidth + 8) - 8;

    const onMove = (ev: MouseEvent) => {
      const dist = Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY);
      splitterDragDistanceRef.current = dist;

      if (dist > 3 && !isDraggingSplitterRef.current) {
        isDraggingSplitterRef.current = true;
        setIsDraggingSplitter(true);
      }

      if (isDraggingSplitterRef.current) {
        if (splitterRafRef.current !== null) return;
        splitterRafRef.current = requestAnimationFrame(() => {
          splitterRafRef.current = null;
          const mouseX = ev.clientX - editorLeft;
          const newFlex = Math.min(Math.max(mouseX / Math.max(available, 100), MIN_EDITOR_FLEX), MAX_EDITOR_FLEX);
          editorFlexRef.current = newFlex;
          setLocalEditorFlex(newFlex);
        });
      }
    };

    const onUp = () => {
      if (splitterRafRef.current !== null) {
        cancelAnimationFrame(splitterRafRef.current);
        splitterRafRef.current = null;
      }
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (isDraggingSplitterRef.current) {
        isDraggingSplitterRef.current = false;
        setIsDraggingSplitter(false);
        setEditorFlex(editorFlexRef.current);
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [MIN_EDITOR_FLEX, MAX_EDITOR_FLEX, setEditorFlex, isSidebarCollapsed]);

  const handleEditorViewerTouchResize = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const touch = e.touches[0];
    if (!touch) return;

    const startX = touch.clientX;
    const startY = touch.clientY;
    dragStartSplitterPosRef.current = { x: startX, y: startY };
    splitterDragDistanceRef.current = 0;

    const rect = container.getBoundingClientRect();
    const currentSidebarWidth = isSidebarCollapsed ? 44 : sidebarWidthRef.current;
    const editorLeft = rect.left + currentSidebarWidth + 8;
    const available = rect.width - (currentSidebarWidth + 8) - 8;

    const onTouchMove = (ev: TouchEvent) => {
      const currentTouch = ev.touches[0];
      if (!currentTouch) return;
      const dist = Math.abs(currentTouch.clientX - startX) + Math.abs(currentTouch.clientY - startY);
      splitterDragDistanceRef.current = dist;

      if (dist > 3 && !isDraggingSplitterRef.current) {
        isDraggingSplitterRef.current = true;
        setIsDraggingSplitter(true);
      }

      if (isDraggingSplitterRef.current) {
        if (splitterRafRef.current !== null) return;
        splitterRafRef.current = requestAnimationFrame(() => {
          splitterRafRef.current = null;
          const touchX = currentTouch.clientX - editorLeft;
          const newFlex = Math.min(Math.max(touchX / Math.max(available, 100), MIN_EDITOR_FLEX), MAX_EDITOR_FLEX);
          editorFlexRef.current = newFlex;
          setLocalEditorFlex(newFlex);
        });
      }
    };

    const onTouchEnd = () => {
      if (splitterRafRef.current !== null) {
        cancelAnimationFrame(splitterRafRef.current);
        splitterRafRef.current = null;
      }
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (isDraggingSplitterRef.current) {
        isDraggingSplitterRef.current = false;
        setIsDraggingSplitter(false);
        setEditorFlex(editorFlexRef.current);
      }
    };

    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  }, [MIN_EDITOR_FLEX, MAX_EDITOR_FLEX, setEditorFlex, isSidebarCollapsed]);

  const handleTogglePDF = useCallback((e: React.MouseEvent) => {
    if (splitterDragDistanceRef.current > 3) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setLayout('editor-only');
  }, [setLayout]);

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

  const [mobileTab, setMobileTab] = useState<'editor' | 'viewer'>('editor');

  useEffect(() => {
    const unsubToggle = EditorEventBus.on('flux:toggle-sidebar', () => {
      setActiveSidebarPanel((prev) => (prev ? null : (lastActiveSidebarPanelRef.current || 'Files')));
    });
    const unsubOpenAi = EditorEventBus.on('flux:open-ai-panel', () => {
      setActiveSidebarPanel('AI');
    });
    const unsubToggleAi = EditorEventBus.on('flux:toggle-ai-panel', () => {
      setActiveSidebarPanel((prev) => (prev === 'AI' ? null : 'AI'));
    });
    const unsubOpenPanel = EditorEventBus.on('flux:open-panel', (detail) => {
      const tabName = typeof detail === 'string' ? detail : detail?.panel;
      if (tabName === 'Explorer' || tabName === 'Outline') {
        setActiveSidebarPanel('Files');
      } else if (tabName) {
        setActiveSidebarPanel(tabName as SidebarTab);
      }
    });
    const unsubTogglePanel = EditorEventBus.on('flux:toggle-panel', (tab) => {
      setActiveSidebarPanel((prev) => (prev === tab ? null : (tab as SidebarTab)));
    });

    return () => {
      unsubToggle();
      unsubOpenAi();
      unsubToggleAi();
      unsubOpenPanel();
      unsubTogglePanel();
    };
  }, [setActiveSidebarPanel]);

  const showEditor = isNarrowScreen
    ? (layout === 'viewer-only' ? false : (layout === 'editor-only' ? true : mobileTab === 'editor'))
    : layout !== 'viewer-only';

  const showViewer = isNarrowScreen
    ? (layout === 'editor-only' ? false : (layout === 'viewer-only' ? true : mobileTab === 'viewer'))
    : layout !== 'editor-only';

  const showDivider = layout === 'split' && !isNarrowScreen;

  if (isHistoryOpen) {
    return <HistoryView />;
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Topbar />

      {/* Mobile Tab Switcher for Split Layout */}
      {isNarrowScreen && layout === 'split' && (
        <div className="flex items-center justify-center p-1.5 bg-secondary/70 border-b border-border shrink-0 z-10">
          <div className="flex items-center rounded-md bg-muted p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMobileTab('editor')}
              className={cn(
                "px-3 py-1 rounded-sm transition-colors cursor-pointer",
                mobileTab === 'editor'
                  ? "bg-background text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              LaTeX Code
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('viewer')}
              className={cn(
                "px-3 py-1 rounded-sm transition-colors cursor-pointer",
                mobileTab === 'viewer'
                  ? "bg-background text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              PDF Preview
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar */}
        <div
          style={{ width: isNarrowScreen ? '100%' : (isSidebarCollapsed ? 44 : localSidebarWidth) }}
          className={cn(
            "shrink-0 overflow-hidden bg-sidebar border-r border-border",
            isNarrowScreen && "hidden",
          )}
        >
          <SideBar activePanel={activeSidebarPanel} onActivePanelChange={setActiveSidebarPanel} />
        </div>

        {/* Mobile Slide-over Drawer for Sidebar */}
        {isNarrowScreen && activeSidebarPanel && (
          <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-xs"
              onClick={() => setActiveSidebarPanel(null)}
              aria-label="Close drawer"
            />
            <div className="relative z-10 w-[85vw] max-w-[340px] h-full bg-muted border-r border-border flex flex-col">
              <header className="flex items-center justify-between px-3 h-11 border-b border-border bg-muted shrink-0">
                <span className="text-xs font-semibold text-foreground">Explorer & Tools</span>
                <button
                  type="button"
                  onClick={() => setActiveSidebarPanel(null)}
                  aria-label="Close sidebar"
                  className="p-1 rounded-md hover:bg-sidebar-hover text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-4 shrink-0" />
                </button>
              </header>
              <div className="flex-1 overflow-hidden">
                <SideBar activePanel={activeSidebarPanel} onActivePanelChange={setActiveSidebarPanel} />
              </div>
            </div>
          </div>
        )}

        {/* Sidebar <-> Editor Splitter */}
        {!isNarrowScreen && !isSidebarCollapsed && (
          <div className="relative shrink-0 flex items-stretch w-2.5 bg-muted border-r border-border select-none">
            <ResizeHandle
              onMouseDown={handleSidebarResize}
              onTouchStart={handleSidebarTouchResize}
              onDoubleClick={handleSidebarReset}
              onKeyDown={handleSidebarKeyDown}
              isDragging={isDraggingSidebar}
              valueNow={localSidebarWidth}
              valueMin={MIN_SIDEBAR}
              valueMax={MAX_SIDEBAR}
              label="Resize sidebar pane (Double-click to reset)"
            >
              {/* Panel Toggle Arrow: Collapse sidebar */}
              <button
                type="button"
                onClick={handleToggleSidebar}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Close sidebar"
                aria-label="Close sidebar"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-full h-12 rounded-none border-y border-border bg-muted-foreground/20 hover:bg-sidebar-accent text-foreground cursor-pointer select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-['']"
              >
                <ChevronLeft className="size-3 shrink-0" strokeWidth={2.5} />
              </button>
            </ResizeHandle>
          </div>
        )}

        {/* Expand Sidebar Button when collapsed */}
        {!isNarrowScreen && isSidebarCollapsed && (
          <div className="relative shrink-0 flex items-stretch w-2.5 bg-muted border-r border-border select-none">
            <button
              type="button"
              onClick={() => {
                setActiveSidebarPanel(lastActiveSidebarPanelRef.current || 'Files');
              }}
              title="Open sidebar"
              aria-label="Open sidebar"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-full h-12 rounded-none bg-muted-foreground/20 hover:bg-sidebar-accent border-y border-border text-foreground cursor-pointer select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-['']"
            >
              <ChevronRight className="size-3 shrink-0" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Editor Column */}
        {showEditor && (
          <div
            style={{ flex: showDivider ? localEditorFlex : 1 }}
            className={cn(
              "min-w-0 flex flex-col",
              (isDraggingSplitter || isDraggingSidebar) && "pointer-events-none select-none"
            )}
          >
            <EditorColumn />
          </div>
        )}

        {/* Editor <-> Viewer Splitter */}
        {showDivider && (
          <div className="relative shrink-0 flex items-stretch w-2.5 bg-muted border-x border-border select-none">
            <ResizeHandle
              onMouseDown={handleEditorViewerResize}
              onTouchStart={handleEditorViewerTouchResize}
              onDoubleClick={handleSplitterReset}
              onKeyDown={handleEditorViewerKeyDown}
              isDragging={isDraggingSplitter}
              valueNow={Math.round(localEditorFlex * 100)}
              valueMin={Math.round(MIN_EDITOR_FLEX * 100)}
              valueMax={Math.round(MAX_EDITOR_FLEX * 100)}
              label="Resize editor and PDF preview panes (Double-click to reset 50/50)"
            >
              {/* Panel Toggle Arrow: Collapse PDF viewer */}
              <button
                type="button"
                onClick={handleTogglePDF}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Close PDF preview"
                aria-label="Close PDF preview"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-full h-12 rounded-none border-y border-border bg-muted-foreground/20 hover:bg-sidebar-accent text-foreground cursor-pointer select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-['']"
              >
                <ChevronRight className="size-3 shrink-0" strokeWidth={2.5} />
              </button>
            </ResizeHandle>
          </div>
        )}

        {/* Expand PDF Viewer Button when collapsed (editor-only) */}
        {!isNarrowScreen && layout === 'editor-only' && (
          <div className="relative shrink-0 flex items-stretch w-2.5 bg-muted border-x border-border select-none">
            <button
              type="button"
              onClick={() => setLayout('split')}
              title="Open PDF preview"
              aria-label="Open PDF preview"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-full h-12 rounded-none bg-muted-foreground/20 hover:bg-sidebar-accent border-y border-border text-foreground cursor-pointer select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-['']"
            >
              <ChevronLeft className="size-3 shrink-0" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Expand Editor Button when editor is collapsed (viewer-only) */}
        {!isNarrowScreen && layout === 'viewer-only' && (
          <div className="relative shrink-0 flex items-stretch w-2.5 bg-muted border-x border-border select-none">
            <button
              type="button"
              onClick={() => setLayout('split')}
              title="Open LaTeX editor"
              aria-label="Open LaTeX editor"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-full h-12 rounded-none bg-muted-foreground/20 hover:bg-sidebar-accent border-y border-border text-foreground cursor-pointer select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-x-2.5 after:inset-y-0 after:content-['']"
            >
              <ChevronRight className="size-3 shrink-0" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* PDF Viewer Column */}
        <div
          style={{
            flex: showDivider ? 1 - localEditorFlex : 1,
            display: showViewer ? undefined : 'none'
          }}
          className={cn(
            "min-w-0 flex flex-col",
            (isDraggingSplitter || isDraggingSidebar) && "pointer-events-none select-none"
          )}
        >
          <Viewer />
        </div>

        {/* Global drag overlay to prevent pointer-events capture by iframes / editors */}
        {(isDraggingSidebar || isDraggingSplitter) && (
          <div
            className="fixed inset-0 z-[99999] cursor-col-resize select-none pointer-events-auto"
            style={{ userSelect: 'none', cursor: 'col-resize' }}
          />
        )}

        {/* Settings Panel */}
        {settingsPanelOpen && <Setting />}
      </div>
    </div>
  );
}
