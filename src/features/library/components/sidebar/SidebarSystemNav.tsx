'use client';

import React from 'react';
import { History, Search, Plus, Trash2 } from 'lucide-react';
import { SidebarNavItem } from './SidebarNavItem';
import { SYSTEM_BOTTOM_NAV_ITEMS, type SystemNavStats } from './sidebar-nav.config';

interface SidebarSystemNavProps {
  basePath: string;
  pathname: string;
  currentFilter: string | null;
  isPersonalScope: boolean;
  navId: string;
  savedSearches?: Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  retractedCount?: number;
  stats?: SystemNavStats;
  onDropItems?: (itemIds: string[], targetCollectionId: string | null) => void;
  onSelectPersonalScope: () => void;
  onDeleteSavedSearch?: (id: string) => void;
  children?: React.ReactNode;
}

export function SidebarSystemNav({
  basePath,
  pathname,
  currentFilter,
  isPersonalScope,
  navId,
  savedSearches,
  currentSavedSearchId,
  retractedCount,
  stats,
  onDropItems,
  onSelectPersonalScope,
  onDeleteSavedSearch,
  children,
}: SidebarSystemNavProps) {
  const isRecentReadActive =
    isPersonalScope &&
    (pathname === `${basePath}/recently-read` ||
      (pathname === basePath && currentFilter === 'recent-read'));

  return (
    <>
      {/* 1. Recently Read */}
      <SidebarNavItem
        href={`${basePath}/recently-read`}
        icon={History}
        label="Recently Read"
        isActive={isRecentReadActive}
        navId={navId}
        onClick={onSelectPersonalScope}
      />

      {/* User Collections Tree */}
      {children}

      {/* 2. Saved Searches (Only rendered when items exist) */}
      {isPersonalScope && savedSearches && savedSearches.length > 0 && (
        <div className="my-1 flex flex-col gap-0.5 border-t border-border pt-1">
          <div className="px-6 py-1 text-11 font-medium text-muted-foreground">
            <span>Saved Searches</span>
          </div>
          {savedSearches.map((ss) => {
            const isSSActive =
              isPersonalScope &&
              currentFilter === 'saved-search' &&
              currentSavedSearchId === ss.id;
            return (
              <div key={ss.id} className="group/item relative flex items-center w-full">
                <div className="flex-1 min-w-0">
                  <SidebarNavItem
                    href={`${basePath}?filter=saved-search&savedSearchId=${ss.id}`}
                    icon={Search}
                    label={ss.name}
                    isActive={isSSActive}
                    navId={navId}
                    onClick={onSelectPersonalScope}
                  />
                </div>
                {onDeleteSavedSearch && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteSavedSearch(ss.id);
                    }}
                    title="Delete saved search"
                    aria-label={`Delete ${ss.name}`}
                    className="absolute right-2 opacity-0 group-hover/item:opacity-100 hover:text-destructive text-muted-foreground cursor-pointer transition-opacity p-1 rounded z-20"
                  >
                    <Trash2 className="size-3 shrink-0" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. System Bottom Filters (Config-driven Registry) */}
      {SYSTEM_BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = item.isActive(pathname, currentFilter, isPersonalScope, basePath);

        return (
          <SidebarNavItem
            key={item.id}
            href={item.href(basePath)}
            icon={item.icon}
            label={item.label}
            isActive={isActive}
            navId={navId}
            onClick={onSelectPersonalScope}
            onDropItems={item.id === 'unfiled' ? (ids) => onDropItems?.(ids, null) : undefined}
          />
        );
      })}
    </>
  );
}
