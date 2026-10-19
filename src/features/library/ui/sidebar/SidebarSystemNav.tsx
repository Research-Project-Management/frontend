'use client';

import React from 'react';
import { History } from 'lucide-react';
import { SidebarNavItem } from './SidebarNavItem';
import { SYSTEM_BOTTOM_NAV_ITEMS, type SystemNavStats } from './sidebar-nav.config';
import { SavedSearchListSection } from './SavedSearchListSection';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';

interface SidebarSystemNavProps {
  basePath: string;
  pathname: string;
  currentFilter: string | null;
  isUserScope?: boolean;
  navId: string;
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFeedId?: string | null;
  retractedCount?: number;
  stats?: SystemNavStats;
  onDropItems?: (itemIds: string[], targetCollectionId: string | null) => void;
  onSelectUserScope?: () => void;
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
  isUserScope = false,
  navId,
  savedSearches,
  currentSavedSearchId,
  currentFeedId,
  onDropItems,
  onSelectUserScope = () => {},
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
  const openModal = useLibraryUIStore((s) => s.openModal);

  const isRecentReadActive =
    isUserScope &&
    pathname === basePath &&
    (currentFilter === 'recently-read' || currentFilter === 'recent-read' || currentFilter === 'recent');

  return (
    <>
      {/* 1. Recently Read */}
      <SidebarNavItem
        href={`${basePath}?filter=recently-read`}
        icon={History}
        label="Recently Read"
        isActive={isRecentReadActive}
        navId={navId}
        onClick={onSelectUserScope}
      />

      {/* User Collections Tree */}
      {children}

      {/* 2. Saved Searches (Only rendered when items exist) */}
      <SavedSearchListSection
        savedSearches={savedSearches as SavedSearch[] | undefined}
        basePath={basePath}
        navId={navId}
        currentFilter={currentFilter}
        currentSavedSearchId={currentSavedSearchId}
        isActiveScope={isUserScope}
        onItemClick={onSelectUserScope}
        onEditSavedSearch={onEditSavedSearch}
        onStartRenameSavedSearch={onStartRenameSavedSearch}
        onSubmitRenameSavedSearch={onSubmitRenameSavedSearch}
        onRenameSavedSearchValueChange={onRenameSavedSearchValueChange}
        onDuplicateSavedSearch={onDuplicateSavedSearch}
        onDeleteSavedSearch={onDeleteSavedSearch}
        renamingSavedSearchId={renamingSavedSearchId}
        renameSavedSearchValue={renameSavedSearchValue}
      />

      {/* 3. System Bottom Filters */}
      <div className="flex flex-col gap-0.5 w-full">
        {SYSTEM_BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = item.isActive(pathname, currentFilter, isUserScope, basePath);

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
            />
          );
        })}
      </div>
    </>
  );
}
