'use client';

import React, { useState, useRef } from 'react';
import {
  History,
  Inbox,
  Files,
  Award,
  ShieldAlert,
  Trash2,
  Star,
  Search,
  SlidersHorizontal,
  X,
  FolderPlus,
  PanelLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { SidebarNavItem } from './CollectionTree';
import { SavedSearchListSection } from './FeedsListSection';
import type { SavedSearch } from '@/features/library/types/ingestion.types';

export { SidebarNavItem };

interface SidebarHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  canManageCollections: boolean;
  onOpenCreateRoot: () => void;
  onOpenCreateSavedSearch?: () => void;
  onToggleCollapse: () => void;
}

export function SidebarHeader({
  searchQuery,
  onSearchChange,
  canManageCollections,
  onOpenCreateRoot,
  onOpenCreateSavedSearch,
  onToggleCollapse,
}: SidebarHeaderProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange('');
    setIsSearchExpanded(false);
  };

  return (
    <div
      className={cn(
        'flex items-center h-8 font-semibold text-sm tracking-tight text-foreground select-none w-full',
        isSearchExpanded || searchQuery ? 'px-0' : 'justify-between px-1',
      )}
    >
      {isSearchExpanded || searchQuery ? (
        <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background overflow-hidden font-normal text-13">
          <Search
            className="absolute top-1/2 -translate-y-1/2 size-3.5 z-10 left-2.5 translate-x-0 text-muted-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <Input
            ref={searchInputRef}
            autoFocus
            placeholder="Search collections..."
            aria-label="Search collections"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearchChange('');
                setIsSearchExpanded(false);
              }
            }}
            onBlur={() => {
              if (!searchQuery) {
                setIsSearchExpanded(false);
              }
            }}
            className="h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none focus:outline-none outline-none shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal pl-8 pr-7 text-foreground"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleClearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
                aria-label="Clear search"
              >
                <X className="size-3 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
              Clear search
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground">
            Library
          </span>

          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={expandSearch}
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Search collections"
                >
                  <Search className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                Search collections
              </TooltipContent>
            </Tooltip>

            {canManageCollections && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    aria-label="New collection"
                  >
                    <FolderPlus className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                  New collection
                </TooltipContent>
              </Tooltip>
            )}

            {canManageCollections && onOpenCreateSavedSearch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCreateSavedSearch}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    aria-label="New saved search"
                  >
                    <SlidersHorizontal
                      className="size-4 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                  New saved search
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Toggle sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                >
                  <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}

interface SidebarResizerProps {
  width: number;
  setWidth: (w: number) => void;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function SidebarResizer({
  width,
  setWidth,
  isDragging,
  onMouseDown,
}: SidebarResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={200}
      aria-valuemax={400}
      aria-label="Resize library sidebar (double-click to reset width)"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={() => setWidth(240)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setWidth(Math.max(200, width - 10));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setWidth(Math.min(400, width + 10));
        }
      }}
      className="hidden md:flex absolute top-0 -right-1.5 w-3 h-full cursor-col-resize items-center justify-center z-30 select-none group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <div
        className={cn(
          'w-0.5 h-full transition-colors duration-150',
          'group-hover:bg-primary',
          isDragging && 'bg-primary',
        )}
      />
    </div>
  );
}

interface SystemNavStats {
  retractedCount?: number;
  unfiledCount?: number;
  duplicateCount?: number;
  starredCount?: number;
}

interface SystemNavItemConfig {
  id: string;
  label: string;
  href: (basePath: string) => string;
  icon: LucideIcon;
  isActive: (
    pathname: string,
    currentFilter: string | null,
    isUserScope: boolean,
    basePath: string,
  ) => boolean;
  getBadge?: (stats: SystemNavStats) => number | null;
}

const SYSTEM_BOTTOM_NAV_ITEMS: SystemNavItemConfig[] = [
  {
    id: 'starred',
    label: 'Starred Items',
    href: (basePath) => `${basePath}?filter=starred`,
    icon: Star,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'starred',
    getBadge: (stats) => stats.starredCount || null,
  },
  {
    id: 'unfiled',
    label: 'Unfiled Items',
    href: (basePath) => `${basePath}?filter=unfiled`,
    icon: Inbox,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'unfiled',
    getBadge: (stats) => stats.unfiledCount || null,
  },
  {
    id: 'duplicates',
    label: 'Duplicate Items',
    href: (basePath) => `${basePath}?filter=duplicates`,
    icon: Files,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'duplicates',
    getBadge: (stats) => stats.duplicateCount || null,
  },
  {
    id: 'my-publications',
    label: 'My Publications',
    href: (basePath) => `${basePath}?filter=my-publications`,
    icon: Award,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'my-publications',
  },
  {
    id: 'retracted',
    label: 'Retracted Items',
    href: (basePath) => `${basePath}?filter=retracted`,
    icon: ShieldAlert,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'retracted',
    getBadge: (stats) => stats.retractedCount || null,
  },
  {
    id: 'trash',
    label: 'Trash',
    href: (basePath) => `${basePath}?filter=trash`,
    icon: Trash2,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === basePath && currentFilter === 'trash',
  },
];

interface SidebarSystemNavProps {
  basePath: string;
  pathname: string;
  currentFilter: string | null;
  isUserScope?: boolean;
  navId: string;
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFeedId?: string | null;
  stats?: SystemNavStats;
  onDropItems?: (itemIds: string[], targetCollectionId: string | null) => void;
  onSelectUserScope?: () => void;
  onDeleteSavedSearch?: (id: string) => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, name: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (value: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  onEmptyTrash?: () => void;
  trashCount?: number;
  canEmptyTrash?: boolean;
  onDropToTrash?: (ids: string[]) => void;
  onDropToMyPublications?: (ids: string[]) => void;
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
  onDropItems,
  onSelectUserScope = () => {},
  onDeleteSavedSearch,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  onDropToTrash,
  onDropToMyPublications,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  children,
}: SidebarSystemNavProps) {
  const isRecentReadActive =
    pathname === basePath && currentFilter === 'recently-read';

  return (
    <>
      <SidebarNavItem
        href={`${basePath}?filter=recently-read`}
        icon={History}
        label="Recently Read"
        isActive={isRecentReadActive}
        navId={navId}
        onClick={onSelectUserScope}
      />

      {children}

      <SavedSearchListSection
        savedSearches={savedSearches as SavedSearch[] | undefined}
        basePath={basePath}
        navId={navId}
        currentFilter={currentFilter}
        currentSavedSearchId={currentSavedSearchId}
        isActiveScope={true}
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

      <div className="flex flex-col gap-0.5 w-full">
        {SYSTEM_BOTTOM_NAV_ITEMS.filter(
          (item) => item.id !== 'my-publications' || isUserScope
        ).map((item) => {
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
              onDropItems={
                item.id === 'unfiled'
                  ? (ids) => onDropItems?.(ids, null)
                  : item.id === 'trash'
                    ? onDropToTrash
                    : item.id === 'my-publications'
                      ? onDropToMyPublications
                      : undefined
              }
            />
          );
        })}
      </div>
    </>
  );
}
