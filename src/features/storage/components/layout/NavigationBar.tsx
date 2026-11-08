'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  useStorageUIStore,
  type StorageSection,
} from '../../store/storage-ui.store';

export const STORAGE_TABS: {
  key: StorageSection;
  label: string;
}[] = [
  { key: 'home', label: 'Home' },
  { key: 'my-files', label: 'All files' },
  { key: 'shared', label: 'Shared' },
  { key: 'starred', label: 'Starred' },
  { key: 'trash', label: 'Trash' },
];

export interface StorageNavigationBarProps {
  counts?: Partial<Record<StorageSection, number>>;
  className?: string;
}

export default function NavigationBar({
  counts = {},
  className,
}: StorageNavigationBarProps) {
  const activeSection = useStorageUIStore((s) => s.activeSection);
  const navigateToSection = useStorageUIStore((s) => s.navigateToSection);

  return (
    <nav
      aria-label="Storage Sub Navigation"
      className={cn(
        'flex items-center gap-1 border-b border-border px-6 bg-background select-none shrink-0 h-10 min-h-10 overflow-x-auto no-scrollbar',
        className,
      )}
    >
      {STORAGE_TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        const count = counts[tab.key];

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigateToSection(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex h-full items-center gap-2 px-3.5 text-13 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 cursor-pointer before:absolute before:-inset-y-0.5 before:inset-x-0 md:before:hidden',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={cn(
                  'text-11 px-1.5 py-0.5 rounded-full font-medium leading-none tabular-nums',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            )}

            {isActive && (
              <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
