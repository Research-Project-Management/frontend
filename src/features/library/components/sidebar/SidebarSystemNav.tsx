'use client';

import React from 'react';
import { History, Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { SidebarNavItem } from './SidebarNavItem';
import { SYSTEM_BOTTOM_NAV_ITEMS, type SystemNavStats } from './sidebar-nav.config';
import { SavedSearchContextMenu } from './SavedSearchContextMenu';
import { parseEmojiPrefix } from '../../utils';
import type { SavedSearch } from '../../types/saved-searches.types';

interface SidebarSystemNavProps {
  basePath: string;
  pathname: string;
  currentFilter: string | null;
  isUserScope?: boolean;
  isPersonalScope?: boolean;
  navId: string;
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  retractedCount?: number;
  stats?: SystemNavStats;
  onDropItems?: (itemIds: string[], targetCollectionId: string | null) => void;
  onSelectUserScope?: () => void;
  onSelectPersonalScope?: () => void;
  onDeleteSavedSearch?: (id: string) => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, name: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (value: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
  children?: React.ReactNode;
}

export function SidebarSystemNav({
  basePath,
  pathname,
  currentFilter,
  isUserScope: propIsUserScope,
  isPersonalScope,
  navId,
  savedSearches,
  currentSavedSearchId,
  retractedCount,
  stats,
  onDropItems,
  onSelectUserScope: propOnSelectUserScope,
  onSelectPersonalScope,
  onDeleteSavedSearch,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  children,
}: SidebarSystemNavProps) {
  const isUserScope = propIsUserScope ?? isPersonalScope ?? false;
  const onSelectUserScope = propOnSelectUserScope ?? onSelectPersonalScope ?? (() => {});

  const isRecentReadActive =
    isUserScope &&
    (pathname === `${basePath}/recently-read` ||
      (pathname === basePath && currentFilter === 'recent-read'));

  const hasSavedSearches = Boolean(
    isUserScope && savedSearches && savedSearches.length > 0,
  );

  return (
    <>
      {/* 1. Recently Read */}
      <SidebarNavItem
        href={`${basePath}/recently-read`}
        icon={History}
        label="Recently Read"
        isActive={isRecentReadActive}
        navId={navId}
        onClick={onSelectUserScope}
      />

      {/* User Collections Tree */}
      {children}

      {/* 2. Saved Searches (Only rendered when items exist) */}
      {isUserScope && savedSearches && savedSearches.length > 0 && (
        <div className="my-1 flex flex-col gap-0.5 border-t border-border pt-1">
          <div className="px-6 py-1 text-11 font-medium text-foreground">
            <span>Saved Searches</span>
          </div>
          {savedSearches.map((ss) => {
            const isSSActive =
              isUserScope &&
              currentFilter === 'saved-search' &&
              currentSavedSearchId === ss.id;

            const isRenaming = renamingSavedSearchId === ss.id;
            const { label: cleanName } = parseEmojiPrefix(ss.name);

            if (isRenaming) {
              return (
                <div
                  key={ss.id}
                  className="relative z-10 flex h-8 w-full items-center pr-2 min-w-0 gap-2.5 pl-6"
                >
                  <Search className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  <input
                    autoFocus
                    value={renameSavedSearchValue}
                    onChange={(e) => onRenameSavedSearchValueChange?.(e.target.value)}
                    onBlur={() => onSubmitRenameSavedSearch?.(ss.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSubmitRenameSavedSearch?.(ss.id);
                      if (e.key === 'Escape') onSubmitRenameSavedSearch?.('__cancel__');
                    }}
                    className="h-7 w-full min-w-0 rounded-md border border-border bg-background px-2 text-13 font-normal focus:outline-none focus:ring-1 focus:ring-ring shadow-none text-foreground"
                  />
                </div>
              );
            }

            return (
              <div key={ss.id} className="group/item relative flex items-center w-full has-[[data-state=open]]:bg-muted rounded-md">
                <div className="flex-1 min-w-0">
                  <SidebarNavItem
                    href={`${basePath}?filter=saved-search&savedSearchId=${ss.id}`}
                    icon={Search}
                    label={cleanName}
                    isActive={isSSActive}
                    navId={navId}
                    onClick={onSelectUserScope}
                  />
                </div>
                <div className="absolute right-1.5 z-20">
                  <SavedSearchContextMenu
                    savedSearch={ss as SavedSearch}
                    onEdit={onEditSavedSearch || (() => {})}
                    onRename={(id, name) => onStartRenameSavedSearch?.(id, name)}
                    onDuplicate={onDuplicateSavedSearch || (() => {})}
                    onDelete={onDeleteSavedSearch || (() => {})}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. System Bottom Filters */}
      <div
        className={cn(
          'my-1 flex flex-col gap-0.5',
          hasSavedSearches && 'border-t border-border pt-1',
        )}
      >
        {SYSTEM_BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = item.isActive(pathname, currentFilter, isUserScope, basePath);
          const badgeCount = item.getBadge?.(stats ?? {});

          return (
            <SidebarNavItem
              key={item.id}
              href={item.href(basePath)}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              navId={navId}
              onClick={onSelectUserScope}
              onDropItems={item.id === 'unfiled' ? (ids) => onDropItems?.(ids, null) : undefined}
              badge={
                badgeCount ? (
                  <span className="relative z-10 ml-auto rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-10 font-medium tabular-nums text-muted-foreground">
                    {badgeCount}
                  </span>
                ) : null
              }
            />
          );
        })}
      </div>
    </>
  );
}
