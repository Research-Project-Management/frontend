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
import { useTabsStore, type EditorTab } from '../../../store/tabs.store';
import { sessionCoordinator } from '../../../coordinators/session.coordinator';
import { editorCommandBus } from '../../../coordinators/command-bus';

// ── Single Tab Item (Overleaf 1:1) ───────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  rootPageId: string;
  onActivate: (id: string) => void;
  onCloseTab: (id: string) => void;
}

const TabItem = React.memo(function TabItem({ tab, isActive, rootPageId, onActivate, onCloseTab }: TabItemProps) {
  const isRoot = tab.id === rootPageId || tab.id === `${rootPageId}-main` || Boolean((tab as any).isRoot);

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
    } else if (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      handleClose();
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
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
        'border-r border-border/50 min-w-0 max-w-[200px] shrink-0 transition-colors motion-reduce:transition-none',
        isActive
          ? 'bg-canvas text-foreground font-medium border-b-transparent before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary'
          : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {/* File Document Icon - Clean project style */}
      <FileText className="size-3.5 shrink-0 text-foreground" />

      {/* Title */}
      <span className="text-12 font-mono truncate leading-normal min-w-0">{tab.title}</span>

      {/* Close button (visible on hover across all tabs, and when focused via keyboard) */}
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
          "size-4 after:absolute after:-inset-1.5 after:content-['']",
          "opacity-0 group-hover/tab:opacity-70 group-hover/tab:hover:opacity-100 group-focus-within/tab:opacity-70 focus-visible:opacity-100",
        )}
      >
        <X className="size-3 shrink-0" />
      </button>
    </div>
  );
});

// ── Main Tabs Component (Only File Tabs - Clean Overleaf style) ───────────────

const EMPTY_TABS: EditorTab[] = [];

export interface TabsProps {
  rootPageId: string;
  activeFileId: string;
  availableFiles?: { id: string; title: string }[];
}

export function EditorTabs({ rootPageId, activeFileId, availableFiles }: TabsProps) {
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
        // Canonical Overleaf standard: root LaTeX entrypoint is always named main.tex
        const normalizedTitle =
          isRoot && (t.title.toLowerCase() === 'flux' || t.title.toLowerCase() === 'flux.tex' || !t.title.includes('.'))
            ? 'main.tex'
            : t.title;
        result.push({ ...t, title: normalizedTitle });
      }
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

    if (tabId !== resolvedActiveTabIdRef.current) {
      sessionCoordinator.switchTab(resolvedActiveTabIdRef.current, isRoot ? rootPageId : tabId);
      useTabsStore.getState().setActive(rootPageId, tabId);
      updateQueryParams(isRoot ? null : tabId);
    }
  }, [rootPageId, updateQueryParams]);

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
    <div className="flex items-stretch h-9 bg-panel select-none border-b border-border">
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
              onActivate={handleTabActivate}
              onCloseTab={handleTabClose}
            />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

export const TabBar = EditorTabs;
export default EditorTabs;
