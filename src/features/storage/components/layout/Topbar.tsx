'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  Search,
  Plus,
  Upload,
  FolderUp,
  FolderPlus,
  Columns3,
  AlignJustify,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { StorageIcon } from '@/shared/components/icons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useTopbar } from '../../hooks/use-topbar';
import { CreateFolderModal, RenameModal } from '../modal/SingleInputModal';
import DuplicateModal from '../modal/DuplicateModal';
import MoveModal from '../modal/MoveModal';
import { StorageFilterPopover } from '../filters/StorageFilterPopover';
import { useViewStore, useStorageUIStore } from '../../store/storage-ui.store';
import NavigationBar from './NavigationBar';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface TopbarProps {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbs?: BreadcrumbItem[];
  onBreadcrumbNavigate?: (folderId: string | null) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  spaceId?: string;
  parentId?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  breadcrumbs,
  onBreadcrumbNavigate,
  searchQuery = '',
  onSearchChange,
  spaceId,
  parentId,
  children,
  className,
}: TopbarProps) {
  const {
    isSearchExpanded,
    inputRef,
    expandSearch,
    collapseSearch,
    handleSearchChange,
    handleClearSearch,
    handleUploadFile,
    handleUploadFolder,
    handleCreateFolder,
    handleFileSelect,
    handleFolderSelect,
    folderInputRef,
    fileInputRef,
    duplicatePrompt,
  } = useTopbar({ searchQuery, onSearchChange, spaceId, parentId });

  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const isCreateFolderOpen = useStorageUIStore((s) => s.isCreateFolderOpen);
  const isRenameOpen = useStorageUIStore((s) => Boolean(s.renamingItem));
  const isMoveOpen = useStorageUIStore((s) => s.movingItems.length > 0);

  const isSubfolder = Boolean(breadcrumbs && breadcrumbs.length > 1);

  return (
    <div className="flex flex-col shrink-0 bg-background select-none z-10 sticky top-0">
      {/* Top Header Row (matching Your Work h-11 header) */}
      <header
        className={cn(
          'flex items-center justify-between border-b border-border bg-background px-6 h-11 shrink-0 select-none relative',
          className,
        )}
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        {/* Left: Storage Title & Subfolder Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0 max-w-[50vw] sm:max-w-[55vw]">
          {isSubfolder ? (
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-1 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  const prevCrumb = breadcrumbs![breadcrumbs!.length - 2];
                  onBreadcrumbNavigate?.(prevCrumb?.id || null);
                }}
                className="md:hidden size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground mr-0.5 shrink-0 cursor-pointer"
                title="Back to previous folder"
                aria-label="Back"
              >
                <ArrowLeft className="size-4 shrink-0" />
              </button>

              <StorageIcon className="size-4 text-foreground shrink-0 mr-1" />
              {breadcrumbs!.map((segment, index) => {
                const isLast = index === breadcrumbs!.length - 1;
                return (
                  <div
                    key={segment.id || `root-${index}`}
                    className="flex items-center gap-1 min-w-0 shrink-0"
                  >
                    {index > 0 && (
                      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => onBreadcrumbNavigate?.(segment.id)}
                      disabled={isLast}
                      className={cn(
                        'text-13 tracking-tight truncate max-w-[110px] sm:max-w-[180px] transition-colors rounded-md px-1 py-0.5',
                        isLast
                          ? 'font-semibold text-foreground cursor-default'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer font-normal',
                      )}
                      title={segment.name}
                    >
                      {segment.name}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <StorageIcon className="size-4 text-foreground shrink-0" />
              <h1 className="text-13 font-semibold text-foreground tracking-tight truncate">
                Storage
              </h1>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Desktop Search Bar */}
          <div
            className={cn(
              'relative hidden md:flex items-center transition-all duration-200 ease-in-out h-7.5 rounded-md overflow-hidden group',
              isSearchExpanded || searchQuery
                ? 'w-56 border border-border bg-background'
                : 'w-7.5 hover:bg-muted cursor-pointer',
            )}
            onClick={expandSearch}
          >
            <Search
              className={cn(
                'absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-200 ease-in-out z-10 shrink-0',
                isSearchExpanded || searchQuery
                  ? 'left-2.5 translate-x-0 text-muted-foreground'
                  : 'left-1/2 -translate-x-1/2 text-foreground',
              )}
            />
            <Input
              ref={inputRef}
              placeholder="Search files & folders..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onBlur={() => collapseSearch(searchQuery)}
              className={cn(
                'h-full text-12 py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-7',
                isSearchExpanded || searchQuery
                  ? 'opacity-100'
                  : 'opacity-0 pointer-events-none',
              )}
              autoFocus={isSearchExpanded}
            />
            {(isSearchExpanded || searchQuery) && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearSearch}
                className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45 shrink-0" />
              </button>
            )}
          </div>

          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={expandSearch}
            className={cn(
              'flex md:hidden size-7.5 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer',
              searchQuery ? 'border-primary bg-muted text-primary' : '',
            )}
            aria-label="Search"
          >
            <Search className="size-3.5 shrink-0" />
          </button>

          {/* Mobile Fullscreen Search Overlay */}
          {isSearchExpanded && (
            <div className="absolute inset-x-2 inset-y-1.5 z-30 flex md:hidden items-center bg-background border border-border rounded-md px-2.5 shadow-md">
              <Search className="size-4 text-muted-foreground shrink-0 mr-2" />
              <input
                type="text"
                placeholder="Search files & folders..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent border-none text-12 text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1 text-muted-foreground hover:text-foreground mr-1"
                  aria-label="Clear query"
                >
                  <Plus className="size-3.5 rotate-45 shrink-0" />
                </button>
              )}
              <button
                type="button"
                onClick={() => collapseSearch(searchQuery)}
                className="text-12 text-primary font-medium px-1.5 py-1 rounded hover:bg-muted"
              >
                Done
              </button>
            </div>
          )}

          {/* View Toggle and Filter */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-muted p-0.5 rounded-md">
              {(['grid', 'list'] as const).map((v) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => React.startTransition(() => setView(v))}
                      className={cn(
                        'relative p-1 rounded-sm transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        view === v
                          ? 'bg-background border border-border text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                      aria-label={`${v} view`}
                    >
                      <span className="relative z-10 flex">
                        {v === 'grid' && (
                          <Columns3
                            className="size-3.5 shrink-0"
                            strokeWidth={1.75}
                          />
                        )}
                        {v === 'list' && (
                          <AlignJustify
                            className="size-3.5 shrink-0"
                            strokeWidth={1.75}
                          />
                        )}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {v === 'grid' ? 'Grid view' : 'List view'}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            <StorageFilterPopover />
          </div>

          {/* New Button / DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-7.5 px-2.5 rounded-md cursor-pointer shrink-0 font-medium text-12 shadow-none inline-flex items-center justify-center gap-1"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-44 p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none space-y-0.5"
            >
              <DropdownMenuItem
                onClick={handleUploadFile}
                className="h-8 gap-2 px-2.5 text-13 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted transition-colors"
              >
                <Upload
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span>Upload file</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleUploadFolder}
                className="h-8 gap-2 px-2.5 text-13 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted transition-colors"
              >
                <FolderUp
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span>Upload folder</span>
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem
                onClick={handleCreateFolder}
                className="h-8 gap-2 px-2.5 text-13 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted transition-colors"
              >
                <FolderPlus
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span>New folder</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {children}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          {...({
            webkitdirectory: 'true',
          } as React.InputHTMLAttributes<HTMLInputElement>)}
          multiple
          onChange={handleFolderSelect}
        />

        {isCreateFolderOpen && <CreateFolderModal spaceId={spaceId} parentId={parentId} />}
        {isRenameOpen && <RenameModal />}
        {isMoveOpen && <MoveModal spaceId={spaceId} />}
        {duplicatePrompt !== null && (
          <DuplicateModal
            isOpen={duplicatePrompt !== null}
            filename={duplicatePrompt?.file.name ?? ''}
            onConfirm={(mode) => duplicatePrompt?.resolve(mode)}
            onClose={() => duplicatePrompt?.resolve('cancel')}
          />
        )}
      </header>

      {/* Horizontal Sub-Navigation Tabs Bar (matching Your Work NavigationBar) */}
      <NavigationBar />
    </div>
  );
}
