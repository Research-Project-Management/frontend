'use client';

/**
 * EditorTabs.tsx
 *
 * Canonical Multi-Document Tab Bar (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/EditorTabs.tsx`
 *
 * Capabilities:
 * - 0ms Tab Switching with in-memory LRU document state preservation.
 * - Single source of truth for active tab (root vs sub-file).
 * - Shallow URL history synchronization (window.history.replaceState, no router transition).
 * - Keyboard navigation (ArrowLeft/Right, Home, End, Enter, Delete, Ctrl+W).
 * - Integrated directly with `sessionCoordinator` (no legacy core dependency).
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { LayoutGroup } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { X, FileText } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTabsStore, useSettingsStore, type EditorTab, editorCommandBus, sessionCoordinator } from '@/features/editor/core';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';

// ── Single Tab Item (Overleaf 1:1) ───────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  rootPageId: string;
  canClose?: boolean;
  onActivate: (id: string) => void;
  onCloseTab: (id: string) => void;
}

const TabItem = React.memo(function TabItem({ tab, isActive, rootPageId, canClose = true, onActivate, onCloseTab }: TabItemProps) {
  const isRoot = tab.id === rootPageId || tab.id === `${rootPageId}-main` || Boolean(tab.isRoot);

  const handleActivate = useCallback(() => {
    onActivate(tab.id);
  }, [onActivate, tab.id]);

  const handleClose = useCallback(() => {
    onCloseTab(tab.id);
  }, [onCloseTab, tab.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    } else if (canClose && (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey)))) {
      e.preventDefault();
      handleClose();
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (canClose && e.button === 1) {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <div
      role="tab"
      id={`editor-tab-${tab.id}`}
      aria-controls="editor-surface"
      aria-selected={isActive}
      aria-label={`Tab: ${tab.title}`}
      tabIndex={isActive ? 0 : -1}
      onClick={handleActivate}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/tab relative flex items-center gap-1.5 h-full px-3 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
        'min-w-0 max-w-[200px] shrink-0 transition-colors motion-reduce:transition-none text-12 border-r border-border/60',
        isActive
          ? 'bg-canvas text-foreground font-medium z-10 before:absolute before:top-0 before:inset-x-0 before:h-[2px] before:bg-primary before:z-20 after:absolute after:bottom-[-1px] after:inset-x-0 after:h-[1px] after:bg-canvas after:z-20'
          : 'bg-surface/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {/* File Document Icon - Clean project style */}
      <FileText className={cn("size-3.5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground group-hover/tab:text-foreground")} />

      {/* Title */}
      <span className="text-12 font-sans font-medium tracking-tight truncate leading-none min-w-0">{tab.title}</span>

      {/* Close button (only shown when canClose is true) */}
      {canClose && (
        <button
          type="button"
          aria-label={`Close file ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          onAuxClick={(e) => e.preventDefault()}
          className={cn(
            "ml-auto shrink-0 relative flex items-center justify-center rounded-xs transition-opacity motion-reduce:transition-none outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer hover:bg-muted text-foreground",
            "size-4 p-0.5 after:absolute after:-inset-2 after:content-['']",
            isActive
              ? "opacity-70 hover:opacity-100"
              : "opacity-40 sm:opacity-0 group-hover/tab:opacity-70 group-hover/tab:hover:opacity-100 group-focus-within/tab:opacity-70 focus-visible:opacity-100",
          )}
        >
          <X className="size-3 shrink-0" />
        </button>
      )}
    </div>
  );
});

// ── Main Tabs Component (Only File Tabs - Clean Overleaf style) ───────────────

const EMPTY_TABS: EditorTab[] = [];

export interface TabsProps {
  rootPageId: string;
  activeFileId: string;
  availableFiles?: { id: string; title: string }[];
  rightSlot?: React.ReactNode;
}

export function EditorTabs({ rootPageId, activeFileId, availableFiles, rightSlot }: TabsProps) {
  const searchParams = useSearchParams();
  const tabListRef = useRef<HTMLDivElement>(null);

  const rawTabs = useTabsStore((s) => s.tabsByProject[rootPageId] ?? EMPTY_TABS);
  const closeTab = useTabsStore((s) => s.closeTab);

  // Guarantee no duplicate tabs are rendered, prune ghost tabs, and normalize root to main.tex
  const tabs = useMemo(() => {
    const isRootDoc = (t: EditorTab) =>
      t.id === rootPageId ||
      t.id === `${rootPageId}-main`;

    const availableIds = availableFiles ? new Set(availableFiles.map((f) => f.id)) : null;

    const configuredMain = useSettingsStore.getState().mainFile || 'main.tex';
    const seen = new Set<string>();
    const result: EditorTab[] = [];
    for (const t of rawTabs) {
      const isRoot = isRootDoc(t);
      // Prune ghost tabs: if availableFiles is loaded, non-root tabs must exist in project files or be an asset
      if (availableIds && !isRoot && !t.id.startsWith('asset:') && !availableIds.has(t.id)) {
        continue;
      }
      const key = isRoot ? '__root__' : (t.id || t.title.toLowerCase());
      if (!seen.has(key)) {
        seen.add(key);
        const trimmedTitle = (t.title || '').trim();
        const normalizedTitle =
          isRoot && (!trimmedTitle || trimmedTitle.toLowerCase() === 'flux')
            ? configuredMain
            : t.title;
        result.push({ ...t, title: normalizedTitle });
      }
    }
    // Overleaf parity: root document entrypoint is always present if rootPageId exists
    if (result.length === 0 && rootPageId) {
      result.push({
        id: rootPageId,
        title: configuredMain,
      });
    }
    return result;
  }, [rawTabs, rootPageId, availableFiles]);

  const updateQueryParams = useCallback((newFile: string | null) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newFile && newFile !== rootPageId && newFile !== `${rootPageId}-main`) {
        url.searchParams.set('file', newFile);
      } else {
        url.searchParams.delete('file');
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
    }
  }, [rootPageId]);

  const currentParam = searchParams.get('file');

  // Single source of truth for the active tab: exactly ONE tab can be active
  const resolvedActiveTabId = useMemo(() => {
    if (tabs.length === 0) return null;

    // 1. If URL has a specific file param that matches a non-root tab:
    if (currentParam && currentParam !== rootPageId && currentParam !== `${rootPageId}-main`) {
      const match = tabs.find((t) => t.id === currentParam || t.title === currentParam);
      if (match) return match.id;
    }

    // 2. If activeFileId passed from props matches a non-root tab:
    if (activeFileId && activeFileId !== rootPageId && activeFileId !== `${rootPageId}-main`) {
      const match = tabs.find((t) => t.id === activeFileId);
      if (match) return match.id;
    }

    // 3. Otherwise root page is active: find the root document tab
    const rootTab = tabs.find(
      (t) => t.id === rootPageId || t.id === `${rootPageId}-main`
    );
    if (rootTab) return rootTab.id;

    // 4. Fallback to the first tab
    return tabs[0]?.id ?? null;
  }, [tabs, currentParam, activeFileId, rootPageId]);

  const resolvedActiveTabIdRef = useRef(resolvedActiveTabId);
  resolvedActiveTabIdRef.current = resolvedActiveTabId;

  const handleTabActivate = useCallback((tabId: string) => {
    const isRoot = tabId === rootPageId || tabId === `${rootPageId}-main`;
    const targetId = isRoot ? rootPageId : tabId;

    if (targetId !== resolvedActiveTabIdRef.current) {
      const targetTab = tabs.find((t) => t.id === tabId);
      navigationCoordinator.openDocument({
        fileId: targetId,
        title: targetTab?.title || '',
        path: targetTab?.path,
      });
    }
  }, [rootPageId, tabs]);

  const handleTabClose = useCallback((tabId: string) => {
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: tabId });
  }, []);

  const handleTabListKeyDown = (e: React.KeyboardEvent) => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.id === resolvedActiveTabId);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      handleTabActivate(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      handleTabActivate(tabs[prevIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleTabActivate(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleTabActivate(tabs[tabs.length - 1].id);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabListRef.current) {
      tabListRef.current.scrollLeft += e.deltaY;
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center h-9 bg-surface select-none border-b border-border w-full px-1 relative">
      {/* ── File tabs ── */}
      <LayoutGroup id={`tab-bar-${rootPageId}`}>
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Open document tabs"
          onKeyDown={handleTabListKeyDown}
          onWheel={handleWheel}
          className="flex h-full overflow-x-auto shrink min-w-0 scrollbar-none items-stretch"
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === resolvedActiveTabId}
              rootPageId={rootPageId}
              canClose={tabs.length > 1 && !(tab.id === rootPageId || tab.id === `${rootPageId}-main` || Boolean(tab.isRoot))}
              onActivate={handleTabActivate}
              onCloseTab={handleTabClose}
            />
          ))}
        </div>
      </LayoutGroup>

      {/* ── Right side: Pane Actions (Split, etc.) ── */}
      {rightSlot && (
        <div className="ml-auto flex items-center h-full shrink-0 px-1.5 gap-1 border-l border-border/40">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

export const TabBar = EditorTabs;
export default EditorTabs;
