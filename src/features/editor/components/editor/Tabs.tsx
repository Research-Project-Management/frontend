'use client';

import React, { useRef, useCallback, useMemo } from 'react';
import { LayoutGroup } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { X, FileText } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTabsStore, type EditorTab } from '@/features/editor/store';

// ── Single Tab Item (Overleaf 1:1) ───────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  rootPageId: string;
  onActivate: () => void;
  onCloseTab: () => void;
}

const TabItem = React.memo(function TabItem({ tab, isActive, rootPageId, onActivate, onCloseTab }: TabItemProps) {
  const isRoot = tab.id === rootPageId || tab.id === `${rootPageId}-main` || Boolean((tab as any).isRoot);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    } else if (!isRoot && (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey)))) {
      e.preventDefault();
      onCloseTab();
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1 && !isRoot) {
      e.preventDefault();
      onCloseTab();
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
      onClick={onActivate}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/tab relative flex items-center gap-1.5 h-full px-3 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
        'border-r border-border/50 min-w-0 max-w-[200px] shrink-0 transition-colors',
        isActive
          ? 'bg-background text-foreground font-medium border-b-transparent before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary'
          : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {/* File Document Icon - Clean project style */}
      <FileText className="size-3.5 shrink-0 text-foreground" />

      {/* Title */}
      <span className="text-12 font-mono truncate leading-normal min-w-0">{tab.title}</span>

      {/* Close button (only on non-root tabs, hidden until hovered) */}
      {!isRoot && (
        <button
          type="button"
          aria-label={`Close file ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onCloseTab();
          }}
          onAuxClick={(e) => e.preventDefault()}
          className="ml-auto shrink-0 size-4 flex items-center justify-center rounded-xs transition-opacity outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer opacity-0 group-hover/tab:opacity-70 group-hover/tab:hover:opacity-100 hover:bg-muted text-foreground"
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
}

export default function Tabs({ rootPageId, activeFileId }: TabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabListRef = useRef<HTMLDivElement>(null);

  const rawTabs = useTabsStore((s) => s.tabsByProject[rootPageId] ?? EMPTY_TABS);
  const closeTab = useTabsStore((s) => s.closeTab);

  // Guarantee no duplicate tabs are rendered for the root document
  const tabs = useMemo(() => {
    const isRootDoc = (t: EditorTab) =>
      t.id === rootPageId ||
      t.id === `${rootPageId}-main`;

    const seen = new Set<string>();
    const result: EditorTab[] = [];
    for (const t of rawTabs) {
      const key = isRootDoc(t) ? '__root__' : (t.id || t.title.toLowerCase());
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    }
    return result;
  }, [rawTabs, rootPageId]);

  const updateQueryParams = useCallback((newFile: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newFile && newFile !== rootPageId && newFile !== `${rootPageId}-main`) {
      params.set('file', newFile);
    } else {
      params.delete('file');
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  }, [pathname, router, searchParams, rootPageId]);

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

  const handleTabActivate = useCallback((tabId: string) => {
    const isRoot = tabId === rootPageId || tabId === `${rootPageId}-main`;

    if (tabId !== resolvedActiveTabId) {
      updateQueryParams(isRoot ? null : tabId);
    }
  }, [rootPageId, resolvedActiveTabId, updateQueryParams]);

  const handleTabClose = useCallback((tabId: string) => {
    closeTab(rootPageId, tabId, (nextId) => {
      const isNextRoot =
        !nextId ||
        nextId === rootPageId ||
        nextId === `${rootPageId}-main`;
      if (!isNextRoot && nextId) {
        updateQueryParams(nextId);
      } else {
        updateQueryParams(null);
      }
    });
  }, [closeTab, rootPageId, updateQueryParams]);

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
    <div className="flex items-stretch h-9 bg-background select-none border-b border-border">
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
          {tabs.map((tab) => {
            const isTabActive = tab.id === resolvedActiveTabId;
            return (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={isTabActive}
                rootPageId={rootPageId}
                onActivate={() => handleTabActivate(tab.id)}
                onCloseTab={() => handleTabClose(tab.id)}
              />
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

export const TabBar = Tabs;
