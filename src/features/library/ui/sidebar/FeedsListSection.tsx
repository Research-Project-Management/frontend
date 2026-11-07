'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Rss, ChevronRight, Plus, CheckCheck, MoreVertical, Pencil, RefreshCw, Trash2, Search, Copy, SlidersHorizontal, Users, Folder, Files } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { CollectionTree, SidebarNavItem, type TreeNode } from './CollectionTree';
import { useFeedsStore } from '@/features/library/core/store/reader.store';
import { useFeedSubscriptionsQuery, useUnsubscribeFeedMutation } from '@/features/library/core/coordinator/curation.coordinator';
import { useLibraryCacheSynchronizer } from '@/features/library/core/coordinator/item-action.coordinator';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type { SavedFeedSubscription, SavedSearch } from '@/features/library/types/ingestion.types';
import type { Collection, CollectionActionHandlers, LibraryScope, ProjectRole } from '@/features/library/types/core.types';
import { getLibraryPermissions } from '@/features/library/domain/library-permissions.policy';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { parseEmojiPrefix } from '@/features/library/domain/citations.domain';

interface FeedContextMenuProps {
  feed: SavedFeedSubscription;
  onRefresh?: (feed: SavedFeedSubscription) => void;
  onMarkAllAsRead?: (feed: SavedFeedSubscription) => void;
  onEdit: (feed: SavedFeedSubscription) => void;
  onDelete: (feed: SavedFeedSubscription) => void;
}

function FeedContextMenu({
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

interface FeedsListSectionProps {
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
                      toast.info(`Refreshing "${feed.name}"...`, { id: 'feed-refresh', duration: 2000 });
                    }}
                    onMarkAllAsRead={async () => {
                      try {
                        await markFeedAsRead(feed.id);
                        toast.success(`Marked all articles in "${feed.name}" as read`, { id: 'feed-mark-read', duration: 2000 });
                      } catch {
                        toast.error(`Failed to mark articles in "${feed.name}" as read`, { id: 'feed-mark-read' });
                      }
                    }}
                    onEdit={(f) => openModal('EDIT_FEED', { feed: f })}
                    onDelete={async (f) => {
                      try {
                        await unsubscribeFeed(f.id);
                        toast.success(`Unsubscribed from "${f.name}"`, { id: 'feed-unsubscribe' });
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

interface SavedSearchContextMenuProps {
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
function SavedSearchContextMenu({
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

interface SavedSearchListSectionProps {
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

export interface ProjectLike {
  id: string;
  name?: string;
  role?: string;
  yourRole?: string;
  permissions?: Partial<import('@/features/library/types/core.types').LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  [key: string]: unknown;
}

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: ProjectLike[];
  activeScope: LibraryScope;
  currentUserId?: string;
  basePath: string;
  navId: string;
  projectTree: TreeNode[];
  projectCollections: Collection[];
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFilter?: string | null;
  activeId: string | string[] | null;
  isSearching: boolean;
  searchQuery: string;
  renamingId: string | null;
  renameValue: string;
  canManageCollections?: boolean;
  onSelectProject: (scope: LibraryScope) => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, name: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (value: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
  pathname?: string;
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
}

export function resolveProjectRole(
  project: ProjectLike | null | undefined,
  _currentUserId?: string,
): ProjectRole {
  if (!project) return 'reviewer';
  const rawServerRole = project.yourRole || project.role;
  if (rawServerRole) {
    const norm = String(rawServerRole).trim().toLowerCase();
    if (norm === 'owner') return 'owner';
    if (norm === 'coordinator') return 'coordinator';
    if (norm === 'contributor') return 'contributor';
    if (norm === 'reviewer') return 'reviewer';
  }
  return 'reviewer';
}

export function ProjectLibrariesSection({
  projects,
  activeScope,
  currentUserId,
  basePath,
  navId,
  projectTree,
  projectCollections,
  savedSearches,
  currentSavedSearchId,
  currentFilter,
  activeId,
  isSearching,
  searchQuery,
  renamingId,
  renameValue,
  canManageCollections: propCanManageCollections,
  onSelectProject,
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onDeleteWithItems,
  onMove,
  onCopy,
  onCreateSub,
  onExportBibtex,
  onExportBundle,
  onLinkClick,
  onDropItems,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  onDeleteSavedSearch,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  pathname = '',
}: ProjectLibrariesSectionProps) {
  const { prefetchProjectScope } = useLibraryCacheSynchronizer(activeScope.id);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="relative group/root flex items-center w-full">
        <button
          type="button"
          onClick={() => setIsProjectsExpanded((v) => !v)}
          className={cn(
            'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8 cursor-pointer text-left',
            activeScope.type === 'project'
              ? 'bg-muted text-foreground font-medium'
              : 'text-foreground hover:bg-muted group-hover/root:bg-muted font-normal',
          )}
        >
          <Users className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
            Project Libraries
          </span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsProjectsExpanded((v) => !v);
              }}
              aria-label={isProjectsExpanded ? 'Collapse Project Libraries' : 'Expand Project Libraries'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-150 shrink-0',
                  isProjectsExpanded && 'rotate-90',
                )}
                strokeWidth={1.5}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
            {isProjectsExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-0.5 w-full">
          {projects.length === 0 ? (
            <div className="pl-6 pr-2.5 py-1.5 text-11 text-muted-foreground italic select-none">
              No project libraries
            </div>
          ) : (
            projects.map((project) => {
              const isProjectActive =
                activeScope.type === 'project' && activeScope.id === project.id;
              const projectCanManageCollections =
                propCanManageCollections !== undefined
                  ? propCanManageCollections
                  : isProjectActive && getLibraryPermissions(activeScope).canManageCollections;

              return (
                <div key={project.id} className="flex flex-col gap-0.5 w-full">
                  <button
                    type="button"
                    onMouseEnter={() => prefetchProjectScope(project.id)}
                    onFocus={() => prefetchProjectScope(project.id)}
                    onClick={() => {
                      const role = resolveProjectRole(project, currentUserId);
                      onSelectProject({
                        type: 'project',
                        id: project.id,
                        projectId: project.id,
                        name: project.name || '',
                        role,
                        ...(project.permissions ? { permissions: project.permissions } : {}),
                        ...(project.effectivePermissions
                          ? { effectivePermissions: project.effectivePermissions }
                          : {}),
                      });
                    }}
                    className={cn(
                      'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 transition-colors outline-none select-none text-left cursor-pointer',
                      isProjectActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted has-[[data-state=open]]:bg-muted font-normal',
                    )}
                  >
                    <Folder className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                    <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
                      {project.name}
                    </span>
                  </button>

                  {isProjectActive && (
                    <div className="flex flex-col gap-0.5 w-full">
                      {projectTree.length > 0 && (
                        <CollectionTree
                          tree={projectTree}
                          allCollections={projectCollections}
                          basePath={basePath}
                          activeId={activeId}
                          navId={navId}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          isSearching={isSearching}
                          searchQuery={searchQuery}
                          canManageCollections={projectCanManageCollections}
                          onStartRename={onStartRename}
                          onSubmitRename={onSubmitRename}
                          onRenameValueChange={onRenameValueChange}
                          onDelete={onDelete}
                          onDeleteWithItems={onDeleteWithItems}
                          onMove={onMove}
                          onCopy={onCopy}
                          onCreateSub={onCreateSub}
                          onExportBibtex={onExportBibtex}
                          onExportBundle={onExportBundle}
                          onLinkClick={onLinkClick}
                          onDropItems={onDropItems}
                        />
                      )}

                      <SavedSearchListSection
                        savedSearches={savedSearches as SavedSearch[] | undefined}
                        basePath={basePath}
                        navId={navId}
                        currentFilter={currentFilter ?? null}
                        currentSavedSearchId={currentSavedSearchId}
                        isActiveScope={isProjectActive}
                        onItemClick={onLinkClick}
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
                        <SidebarNavItem
                          href={`${basePath}/duplicates`}
                          icon={Files}
                          label="Duplicate Items"
                          isActive={pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates')}
                          navId={navId}
                          onClick={onLinkClick}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
