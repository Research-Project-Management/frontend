'use client';

import React, { useRef, useCallback } from 'react';
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

const TabItem = React.memo(function TabItem({ tab, isActive, onActivate, onCloseTab }: TabItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    } else if (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      onCloseTab();
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
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
        'group/tab relative flex items-center gap-1.5 h-full px-3 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset',
        'border-r border-border min-w-0 max-w-[200px] shrink-0 transition-colors',
        isActive
          ? 'bg-background text-foreground font-medium border-t-2 border-t-primary'
          : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground border-t-2 border-t-transparent',
      )}
    >
      {/* File Document Icon */}
      <FileText className="size-3.5 shrink-0 opacity-70" />

      {/* Title */}
      <span className="text-12 font-mono truncate leading-normal">{tab.title}</span>

      {/* Close button */}
      <button
        type="button"
        aria-label={`Close file ${tab.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onCloseTab();
        }}
        onAuxClick={(e) => e.preventDefault()}
        className={cn(
          'relative ml-auto shrink-0 size-4 min-w-[16px] min-h-[16px] flex items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer',
          'after:absolute after:-inset-1.5 after:content-[""]',
          isActive
            ? 'opacity-60 hover:opacity-100 hover:bg-muted hover:text-foreground'
            : 'opacity-0 group-hover/tab:opacity-60 group-hover/tab:hover:opacity-100 hover:bg-muted hover:text-foreground',
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
}

export default function Tabs({ rootPageId, activeFileId }: TabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabListRef = useRef<HTMLDivElement>(null);

  const tabs = useTabsStore((s) => s.tabsByProject[rootPageId] ?? EMPTY_TABS);
  const closeTab = useTabsStore((s) => s.closeTab);

  const updateQueryParams = useCallback((newFile: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newFile && newFile !== rootPageId) {
      params.set('file', newFile);
    } else {
      params.delete('file');
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  }, [pathname, router, searchParams, rootPageId]);

  const handleTabActivate = useCallback((tabId: string) => {
    const isRoot = tabId === rootPageId;
    const currentParam = searchParams.get('file');
    const isCurrentActive = tabId === activeFileId || (isRoot && !currentParam);
    if (!isCurrentActive) {
      updateQueryParams(isRoot ? null : tabId);
    }
  }, [activeFileId, rootPageId, searchParams, updateQueryParams]);

  const handleTabClose = useCallback((tabId: string) => {
    closeTab(rootPageId, tabId, (nextId) => {
      if (nextId && nextId !== rootPageId) {
        updateQueryParams(nextId);
      } else {
        updateQueryParams(null);
      }
    });
  }, [closeTab, rootPageId, updateQueryParams]);

  const handleTabListKeyDown = (e: React.KeyboardEvent) => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeFileId);

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
            const isRoot = tab.id === rootPageId || tab.title === 'main.tex';
            const currentParam = searchParams.get('file');
            const isTabActive = tab.id === activeFileId || (isRoot && (!currentParam || currentParam === rootPageId));
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
