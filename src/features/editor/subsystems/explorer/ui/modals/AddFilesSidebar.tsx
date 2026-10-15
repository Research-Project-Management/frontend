'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { AddFilesTab, AddFilesTabItem } from './add-files.types';

export interface AddFilesSidebarProps {
  tabs: AddFilesTabItem[];
  activeTab: AddFilesTab;
  onSelectTab: (tab: AddFilesTab) => void;
}

export function AddFilesSidebar({
  tabs,
  activeTab,
  onSelectTab,
}: AddFilesSidebarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== -1) {
      const nextTab = tabs[nextIndex];
      onSelectTab(nextTab.id);
      document.getElementById(`add-files-tab-${nextTab.id}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Add file methods"
      aria-orientation="vertical"
      onKeyDown={handleKeyDown}
      className="w-full sm:w-56 p-3 sm:border-r border-b sm:border-b-0 border-border bg-muted/20 flex sm:flex-col gap-1 shrink-0 overflow-x-auto sm:overflow-x-visible outline-none"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            id={`add-files-tab-${id}`}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            aria-controls={`add-files-panel-${id}`}
            onClick={() => onSelectTab(id)}
            className={cn(
              'w-full min-h-[34px] flex items-center gap-2.5 px-3 py-2 rounded-md text-12 font-medium text-left transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary whitespace-nowrap',
              isActive
                ? 'bg-background text-foreground font-semibold border border-border/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
