'use client';

import React from 'react';
import {
  Library,
  FileText,
  X,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { ReaderDocument } from '../types/reader.types';
import type { ReaderTab } from '../store/reader.store';

export interface TopbarProps {
  paper?: ReaderDocument | null;
  tabs?: ReaderTab[];
  activeTabId?: string;
  scopeTitle?: string;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onBack?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function Topbar({
  paper,
  tabs = [],
  activeTabId,
  scopeTitle,
  onSelectTab,
  onCloseTab,
  onBack,
}: TopbarProps) {
  const libraryTitle = scopeTitle || 'My Library';
  // If tabs are empty or missing, fallback to single active tab representation
  const effectiveTabs: ReaderTab[] = tabs.length > 0
    ? tabs.map((t) =>
        t.id === 'library' || t.type === 'library'
          ? { ...t, title: libraryTitle }
          : t,
      )
    : [
        { id: 'library', title: libraryTitle, type: 'library' },
        ...(paper ? [{ id: paper.id, title: paper.title || 'Untitled Document', type: 'paper' as const }] : []),
      ];

  const currentTabId = activeTabId || (paper ? paper.id : 'library');

  return (
    <header className="h-9 shrink-0 bg-background border-b border-border flex items-center px-1 select-none z-30 text-12">
      {/* Scrollable Tabs Bar */}
      <div
        role="tablist"
        aria-label="Open document tabs"
        className="flex items-center h-full gap-0.5 overflow-x-auto min-w-0 flex-1 thin-scrollbar pt-1"
      >
        {effectiveTabs.map((tab) => {
          const isActive = tab.id === currentTabId;
          const isLibrary = tab.id === 'library' || tab.type === 'library';

          if (isLibrary) {
            const tabTitle = tab.title || libraryTitle;
            return (
              <button
                key="library"
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (onSelectTab) onSelectTab('library');
                  else if (onBack) onBack();
                }}
                className={cn(
                  "h-8 px-3 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  isActive
                    ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                    : "text-foreground hover:bg-muted"
                )}
                title={tabTitle}
              >
                <Library className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
                <span className="truncate max-w-[140px]">{tabTitle}</span>
              </button>
            );
          }

          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => onSelectTab?.(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTab?.(tab.id);
                }
              }}
              className={cn(
                "h-8 px-2.5 flex items-center gap-1.5 rounded-t-md transition-colors cursor-pointer shrink-0 text-12 max-w-[240px] group outline-none focus-visible:ring-1 focus-visible:ring-primary",
                isActive
                  ? "bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10"
                  : "text-foreground hover:bg-muted"
              )}
              title={tab.title}
            >
              <FileText className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              <span className="truncate flex-1 font-medium">{tab.title || 'Untitled Document'}</span>
              
              {onCloseTab && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={cn(
                    "size-4 flex items-center justify-center rounded-sm hover:bg-muted text-foreground transition-all cursor-pointer shrink-0",
                    isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  title="Close tab"
                  aria-label={`Close tab ${tab.title}`}
                >
                  <X className="size-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}

export default Topbar;
