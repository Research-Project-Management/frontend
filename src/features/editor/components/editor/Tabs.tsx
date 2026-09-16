'use client';

import React, { useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { X, Code, Eye, FileCheck } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTabsStore, useSettingsStore, type EditorTab } from '@/features/editor/store';

// ── File indicator colors ───────────────────────────────────────────────────

function fileIndicatorClass(title: string, isActive: boolean): string {
  const ext = title.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'tex') {
    return isActive ? 'bg-primary' : 'bg-primary/60';
  }
  if (ext === 'bib' || ext === 'cls' || ext === 'sty') {
    return isActive ? 'bg-foreground/70' : 'bg-muted-foreground/60';
  }
  return 'bg-muted-foreground/40';
}

// ── Single Tab Item ─────────────────────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  rootPageId: string;
  onActivate: () => void;
  onCloseTab: () => void;
}

function TabItem({ tab, isActive, rootPageId, onActivate, onCloseTab }: TabItemProps) {
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
      aria-selected={isActive}
      aria-label={`Tab: ${tab.title}`}
      tabIndex={isActive ? 0 : -1}
      onClick={onActivate}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/tab relative flex items-center gap-2 h-full px-3 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
        'border-r border-border min-w-0 max-w-[200px] shrink-0',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-all',
        isActive
          ? 'bg-background text-foreground font-medium'
          : 'bg-muted text-muted-foreground hover:bg-background/40 hover:opacity-90',
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.span
          layoutId={`editor-tab-active-${rootPageId}`}
          className="absolute inset-x-0 top-0 h-[2px] bg-primary rounded-b-sm"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      {/* File dot */}
      <span
        className={cn('size-1.5 rounded-full shrink-0', fileIndicatorClass(tab.title, isActive))}
      />

      {/* Title */}
      <span className="text-xs truncate leading-none">{tab.title}</span>

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
          'ml-auto shrink-0 size-6 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer',
          isActive
            ? 'opacity-70 hover:opacity-100 hover:bg-muted'
            : 'opacity-0 group-hover/tab:opacity-70 group-hover/tab:hover:opacity-100 hover:bg-muted focus-visible:opacity-100',
        )}
      >
        <X className="size-3.5 shrink-0" />
      </button>
    </div>
  );
}

// ── Main Tabs Component ─────────────────────────────────────────────────────

export interface TabsProps {
  rootPageId: string;
  activeFileId: string;
}

export default function Tabs({ rootPageId, activeFileId }: TabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabListRef = useRef<HTMLDivElement>(null);

  const { getTabs, closeTab } = useTabsStore();
  const tabs = getTabs(rootPageId);
  const { editorMode, setEditorMode, reviewMode, toggleReviewMode } = useSettingsStore();

  const updateQueryParams = (newFile: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newFile) {
      params.set('file', newFile);
    } else {
      params.delete('file');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleTabActivate = (tabId: string) => {
    if (tabId !== activeFileId) {
      updateQueryParams(tabId);
    }
  };

  const handleTabClose = (tabId: string) => {
    closeTab(rootPageId, tabId, (nextId) => {
      if (nextId) {
        updateQueryParams(nextId);
      } else {
        updateQueryParams(null);
      }
    });
  };

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
    <div className="flex items-center justify-between h-10 bg-secondary/70 border-b border-border px-1 gap-2">
      {/* ── Left: File tabs ── */}
      <LayoutGroup id={`tab-bar-${rootPageId}`}>
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Open document tabs"
          onKeyDown={handleTabListKeyDown}
          onWheel={handleWheel}
          className="flex h-full overflow-x-auto shrink min-w-0 scrollbar-none items-center"
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeFileId}
              rootPageId={rootPageId}
              onActivate={() => handleTabActivate(tab.id)}
              onCloseTab={() => handleTabClose(tab.id)}
            />
          ))}
        </div>
      </LayoutGroup>

      {/* ── Right: Overleaf-style [ Code | Visual ] mode switcher & Review toggle ── */}
      <div className="flex items-center gap-1.5 shrink-0 pr-1">
        {/* Track Changes / Review Mode Button */}
        <button
          type="button"
          onClick={toggleReviewMode}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer border',
            reviewMode
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
              : 'bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground',
          )}
          title="Toggle Track Changes / Suggestion Mode"
        >
          <FileCheck className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Review{reviewMode ? ': On' : ''}</span>
        </button>

        {/* [ Code | Visual ] Switcher */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/70 text-xs">
          <button
            type="button"
            onClick={() => setEditorMode('code')}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer',
              editorMode === 'code'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Source Code Editor"
          >
            <Code className="size-3.5 shrink-0" />
            <span>Code</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer',
              editorMode === 'visual'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Visual WYSIWYG Editor"
          >
            <Eye className="size-3.5 shrink-0" />
            <span>Visual</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const TabBar = Tabs;
