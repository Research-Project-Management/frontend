'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  History,
  Inbox,
  Files,
  Award,
  ShieldAlert,
  Trash2,
  Star,
  MoreVertical,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { logger } from '@/shared/lib/logger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { SavedSearchListSection } from './FeedsListSection';
import type { SavedSearch } from '@/features/library/domain/types/ingestion.types';

export interface SidebarResizerProps {
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

export interface SidebarNavItemProps {
  href: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  customIcon?: React.ReactNode;
  label: string;
  isActive: boolean;
  navId?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  contextMenu?: React.ReactNode;
  onClick?: () => void;
  onDropItems?: (itemIds: string[]) => void;
}

export function SidebarNavItem({
  href,
  icon: Icon,
  customIcon,
  label,
  isActive,
  badge,
  action,
  contextMenu,
  onClick,
  onDropItems,
}: SidebarNavItemProps) {
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropItems) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOverTarget) setIsDragOverTarget(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!onDropItems) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropItems) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTarget(false);
      try {
        const raw = e.dataTransfer.getData('application/x-flux-items');
        if (raw) {
          const parsed = JSON.parse(raw) as string[] | { ids?: string[] };
          const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
          if (ids.length > 0) {
            onDropItems(ids);
          }
        }
      } catch (err) {
        logger.error('Failed to parse dropped items', err);
      }
    }
  };

  const linkContent = (
    <Link
      href={href}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 text-13 leading-5 outline-none select-none pl-6',
        action && 'pr-8',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'text-foreground hover:bg-muted group-hover/item:bg-muted has-[[data-state=open]]:bg-muted font-normal',
        isDragOverTarget && 'bg-primary/10 text-primary font-medium ring-1 ring-primary ring-inset',
      )}
    >
      {customIcon ? (
        <span className="relative z-10 flex size-4 shrink-0 items-center justify-center text-13 leading-none select-none">
          {customIcon}
        </span>
      ) : Icon ? (
        <Icon
          className="relative z-10 size-4 shrink-0 text-foreground"
          strokeWidth={1.5}
        />
      ) : null}
      <span
        className={cn(
          'relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground',
          isActive ? 'font-medium' : 'font-normal',
        )}
      >
        {label}
      </span>
      {badge}
    </Link>
  );

  return (
    <div className="group/item relative flex items-center w-full">
      {contextMenu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{linkContent}</ContextMenuTrigger>
          {contextMenu}
        </ContextMenu>
      ) : (
        linkContent
      )}
      {action && (
        <div className="absolute right-1.5 z-20 flex items-center">
          {action}
        </div>
      )}
    </div>
  );
}

export interface SystemNavStats {
  retractedCount?: number;
  unfiledCount?: number;
  duplicateCount?: number;
  starredCount?: number;
}

export interface SystemNavItemConfig {
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

export const SYSTEM_BOTTOM_NAV_ITEMS: SystemNavItemConfig[] = [
  {
    id: 'starred',
    label: 'Starred Items',
    href: (basePath) => `${basePath}?filter=starred`,
    icon: Star,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope && pathname === basePath && currentFilter === 'starred',
    getBadge: (stats) => stats.starredCount || null,
  },
  {
    id: 'unfiled',
    label: 'Unfiled Items',
    href: (basePath) => `${basePath}?filter=unfiled`,
    icon: Inbox,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope && pathname === basePath && currentFilter === 'unfiled',
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
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope && pathname === basePath && currentFilter === 'my-publications',
  },
  {
    id: 'retracted',
    label: 'Retracted Items',
    href: (basePath) => `${basePath}?filter=retracted`,
    icon: ShieldAlert,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope && pathname === basePath && currentFilter === 'retracted',
    getBadge: (stats) => stats.retractedCount || null,
  },
  {
    id: 'trash',
    label: 'Trash',
    href: (basePath) => `${basePath}?filter=trash`,
    icon: Trash2,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope && pathname === basePath && currentFilter === 'trash',
  },
];

export interface TrashContextMenuProps {
  onEmptyTrash: () => void;
  isEmpty?: boolean;
  canEmpty?: boolean;
}

export function TrashContextMenuAction({
  onEmptyTrash,
  isEmpty = false,
  canEmpty = true,
}: TrashContextMenuProps) {
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
          aria-label="Trash options"
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4} className="w-44">
        <DropdownMenuItem
          onClick={onEmptyTrash}
          disabled={isEmpty || !canEmpty}
          className="text-destructive focus:text-destructive gap-2 text-12 cursor-pointer"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Empty Trash...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TrashContextMenuContent({
  onEmptyTrash,
  isEmpty = false,
  canEmpty = true,
}: TrashContextMenuProps) {
  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem
        onClick={onEmptyTrash}
        disabled={isEmpty || !canEmpty}
        className="text-destructive focus:text-destructive gap-2 text-12 cursor-pointer"
      >
        <Trash2 className="size-3.5 shrink-0" />
        <span>Empty Trash...</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

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
  onEmptyTrash,
  trashCount = 0,
  canEmptyTrash = true,
  onDropToTrash,
  onDropToMyPublications,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  children,
}: SidebarSystemNavProps) {
  const isRecentReadActive =
    isUserScope && pathname === basePath && currentFilter === 'recently-read';

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

      <div className="flex flex-col gap-0.5 w-full">
        {SYSTEM_BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = item.isActive(pathname, currentFilter, isUserScope, basePath);
          const isTrash = item.id === 'trash';
          const isTrashEmpty = trashCount === 0;

          return (
            <SidebarNavItem
              key={item.id}
              href={item.href(basePath)}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              navId={navId}
              onClick={onSelectUserScope}
              action={
                isTrash && onEmptyTrash ? (
                  <TrashContextMenuAction
                    onEmptyTrash={onEmptyTrash}
                    isEmpty={isTrashEmpty}
                    canEmpty={canEmptyTrash}
                  />
                ) : undefined
              }
              contextMenu={
                isTrash && onEmptyTrash ? (
                  <TrashContextMenuContent
                    onEmptyTrash={onEmptyTrash}
                    isEmpty={isTrashEmpty}
                    canEmpty={canEmptyTrash}
                  />
                ) : undefined
              }
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
