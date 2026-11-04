'use client';

import React, { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Rss, ChevronRight, Plus, CheckCheck, MoreVertical, Pencil, RefreshCw, Trash2, Search, Copy, SlidersHorizontal, X, FolderPlus, PanelLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { SidebarNavItem } from './SidebarSystemNav';
import { useFeedsStore } from '@/features/library/core/store/reader.store';
import { useFeedSubscriptionsQuery, useUnsubscribeFeedMutation } from '@/features/library/sdk/queries/ingestion.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/ingestion.types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { parseEmojiPrefix } from '@/features/library/domain/citations';
import type { SavedSearch } from '@/features/library/domain/types/ingestion.types';
import { Input } from '@/shared/components/ui/input';

export interface FeedContextMenuProps {
  feed: SavedFeedSubscription;
  onRefresh?: (feed: SavedFeedSubscription) => void;
  onMarkAllAsRead?: (feed: SavedFeedSubscription) => void;
  onEdit: (feed: SavedFeedSubscription) => void;
  onDelete: (feed: SavedFeedSubscription) => void;
}

export function FeedContextMenu({
  feed,
  onRefresh,
  onMarkAllAsRead,
  onEdit,
  onDelete,
}: FeedContextMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          aria-label={`Options for ${feed.name}`}
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        {onRefresh && (
          <DropdownMenuItem
            onClick={() => onRefresh(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Refresh Feed</span>
          </DropdownMenuItem>
        )}

        {onMarkAllAsRead && (
          <DropdownMenuItem
            onClick={() => onMarkAllAsRead(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <CheckCheck className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Mark Feed as Read</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => onEdit(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Feed...</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => onDelete(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
          <span>Unsubscribe</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface FeedsListSectionProps {
  basePath: string;
  navId: string;
  currentFilter: string | null;
  currentFeedId?: string | null;
  isActiveScope?: boolean;
  onItemClick?: () => void;
}

export function FeedsListSection({
  basePath,
  navId,
  currentFilter,
  currentFeedId,
  isActiveScope = true,
  onItemClick,
}: FeedsListSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  useFeedSubscriptionsQuery({ enabled: isActiveScope });
  const feeds = useFeedsStore((s) => s.feeds);
  const { mutateAsync: unsubscribeFeed } = useUnsubscribeFeedMutation();
  const triggerRefresh = useFeedsStore((s) => s.triggerRefresh);
  const markFeedAsRead = useFeedsStore((s) => s.markFeedAsRead);
  const setActiveFeedId = useFeedsStore((s) => s.setActiveFeedId);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isActiveScope) {
    return null;
  }

  const isFeedsRootActive = pathname === `${basePath}/feeds`;

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="relative group/root flex items-center w-full">
        <div
          onClick={() => {
            setIsExpanded(true);
            router.push(`${basePath}/feeds`);
            onItemClick?.();
          }}
          className={cn(
            'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-14 cursor-pointer text-left font-normal',
            isFeedsRootActive
              ? 'bg-muted font-medium text-foreground'
              : 'text-foreground hover:bg-muted group-hover/root:bg-muted',
          )}
        >
          <Rss className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground">
            Feeds
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModal('ADD_FEED');
              }}
              className="absolute right-7 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background opacity-0 max-md:opacity-100 group-hover/root:opacity-100 focus-visible:opacity-100 cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="New feed"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            New feed
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded((v) => !v);
              }}
              aria-label={isExpanded ? 'Collapse Feeds' : 'Expand Feeds'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-150 shrink-0',
                  isExpanded && 'rotate-90',
                )}
                strokeWidth={1.5}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isExpanded && feeds.length === 0 && (
        <div className="px-3 py-1.5 text-11 text-muted-foreground/60 italic select-none">
          No feeds subscribed
        </div>
      )}
      {isExpanded && feeds.length > 0 && (
        <div className="flex flex-col gap-0.5 w-full">
          {feeds.map((feed) => {
            const isFeedActive =
              pathname === `${basePath}/feeds/${feed.id}` ||
              (currentFilter === 'feed' &&
                (currentFeedId === feed.id || (!currentFeedId && feed === feeds[0])));

            return (
              <SidebarNavItem
                key={feed.id}
                href={`${basePath}/feeds/${feed.id}`}
                icon={Rss}
                label={feed.name}
                isActive={isFeedActive}
                navId={navId}
                onClick={onItemClick}
                action={
                  <FeedContextMenu
                    feed={feed}
                    onRefresh={() => {
                      setActiveFeedId(feed.id);
                      triggerRefresh();
                      toast.info(`Refreshing "${feed.name}"...`);
                    }}
                    onMarkAllAsRead={async () => {
                      try {
                        await markFeedAsRead(feed.id);
                        toast.success(`Marked all articles in "${feed.name}" as read`);
                      } catch {
                        toast.error(`Failed to mark articles in "${feed.name}" as read`);
                      }
                    }}
                    onEdit={(f) => openModal('EDIT_FEED', { feed: f })}
                    onDelete={async (f) => {
                      try {
                        await unsubscribeFeed(f.id);
                        toast.success(`Unsubscribed from "${f.name}"`);
                      } catch {
                        // Error toast handled by mutation or caller
                      }
                    }}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FeedsListSection;

export interface SavedSearchContextMenuProps {
  savedSearch: SavedSearch;
  onEdit: (savedSearch: SavedSearch) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (savedSearch: SavedSearch) => void;
  onDelete: (id: string) => void;
}

/**
 * SavedSearchContextMenu (Smart Search Menu)
 * Provides complete lifecycle management: Edit Criteria, Rename, Duplicate, Delete.
 */
export function SavedSearchContextMenu({
  savedSearch,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
}: SavedSearchContextMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label={`Options for ${savedSearch.name}`}
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        <DropdownMenuItem
          onClick={() => onEdit(savedSearch)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <SlidersHorizontal className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Saved Search...</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onRename(savedSearch.id, savedSearch.name)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Rename Saved Search</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onDuplicate(savedSearch)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Duplicate Saved Search</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => onDelete(savedSearch.id)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
          <span>Delete Saved Search</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SavedSearchListSectionProps {
  savedSearches?: SavedSearch[];
  basePath: string;
  navId: string;
  currentFilter: string | null;
  currentSavedSearchId?: string | null;
  isActiveScope?: boolean;
  onItemClick?: () => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, currentName: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (val: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
}

export function SavedSearchListSection({
  savedSearches,
  basePath,
  navId,
  currentFilter,
  currentSavedSearchId,
  isActiveScope = true,
  onItemClick,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  onDeleteSavedSearch,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
}: SavedSearchListSectionProps) {
  if (!isActiveScope || !savedSearches || savedSearches.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="px-6 py-1 text-11 font-medium text-foreground flex items-center justify-between">
        <span>Saved Searches</span>
      </div>
      {savedSearches.map((ss) => {
        const isSSActive =
          isActiveScope &&
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
          <SidebarNavItem
            key={ss.id}
            href={`${basePath}?filter=saved-search&savedSearchId=${ss.id}`}
            icon={Search}
            label={cleanName}
            isActive={isSSActive}
            navId={navId}
            onClick={onItemClick}
            action={
              <SavedSearchContextMenu
                savedSearch={ss}
                onEdit={onEditSavedSearch || (() => {})}
                onRename={(id, name) => onStartRenameSavedSearch?.(id, name)}
                onDuplicate={onDuplicateSavedSearch || (() => {})}
                onDelete={onDeleteSavedSearch || (() => {})}
              />
            }
          />
        );
      })}
    </div>
  );
}

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
    onSearchChange("");
    setIsSearchExpanded(false);
  };

  return (
    <div
      className={cn(
        "flex items-center h-8 font-semibold text-sm tracking-tight text-foreground select-none w-full",
        isSearchExpanded || searchQuery ? "px-0" : "justify-between px-1"
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
              if (e.key === "Escape") {
                onSearchChange("");
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
                <X
                  className="size-3 shrink-0"
                  strokeWidth={1.5}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              sideOffset={6}
              alignOffset={2}
            >
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
            {/* Search collections toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={expandSearch}
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Search collections"
                >
                  <Search
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                Search collections
              </TooltipContent>
            </Tooltip>

            {/* New collection button */}
            {canManageCollections && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    aria-label="New collection"
                  >
                    <FolderPlus
                      className="size-4 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  New collection
                </TooltipContent>
              </Tooltip>
            )}

            {/* New saved search button */}
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
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  New saved search
                </TooltipContent>
              </Tooltip>
            )}

            {/* Toggle / Collapse Sidebar Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Toggle sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                >
                  <PanelLeft
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
