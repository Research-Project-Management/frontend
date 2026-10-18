'use client';

import { Search } from 'lucide-react';
import { SidebarNavItem } from './SidebarNavItem';
import { SavedSearchContextMenu } from './SavedSearchContextMenu';
import { parseEmojiPrefix } from '@/features/library/domain/academic-text';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';

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
    <div className="my-1 flex flex-col gap-0.5">
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
