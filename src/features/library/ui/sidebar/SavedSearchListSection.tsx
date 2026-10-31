'use client';

import React from 'react';
import {
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { SidebarNavItem } from './SidebarSystemNav';
import { parseEmojiPrefix } from '@/features/library/domain/academic-text';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';

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
