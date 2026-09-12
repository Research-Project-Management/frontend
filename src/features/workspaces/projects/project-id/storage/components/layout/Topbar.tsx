'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/shared/lib/utils";
import { HardDrive, Search, Plus, Upload, FolderUp, FolderPlus, Columns3, AlignJustify, ListFilter, ChevronRight } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui";
import { useTopbar } from '../../hooks/use-topbar';
import CreateFolderModal from '../modals/CreateFolderModal';
import RenameModal from '../modals/RenameModal';
import DuplicateModal from '../modals/DuplicateModal';
import MoveModal from '../modals/MoveModal';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { StorageFilterPopover } from '../filters/StorageFilterPopover';
import { ProjectTopbarSwitcher } from '@/features/workspaces/projects/project-id/components/layout';

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
  projectId?: string;
  parentId?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title,
  icon: Icon = HardDrive,
  breadcrumbs,
  onBreadcrumbNavigate,
  searchQuery = "",
  onSearchChange,
  projectId,
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
  } = useTopbar({ searchQuery, onSearchChange, projectId, parentId });

  const { view, setView } = useViewStore();

  return (
    <header
      className={cn(
        'flex h-11 w-full items-center justify-between border-b border-border bg-background/80 px-4 py-2 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none',
        className
      )}
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center min-w-0 max-w-[55vw]">
        <ProjectTopbarSwitcher
          moduleTitle={breadcrumbs && breadcrumbs.length > 1 ? breadcrumbs[0].name : (title || 'Files')}
          moduleIcon={Icon}
        >
          {breadcrumbs && breadcrumbs.length > 1 && (
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-1 ml-1">
              {breadcrumbs.slice(1).map((segment, index) => {
                const isLast = index === breadcrumbs.length - 2;
                return (
                  <div key={segment.id || `sub-${index}`} className="flex items-center gap-1 min-w-0 shrink-0">
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <button
                      type="button"
                      onClick={() => onBreadcrumbNavigate?.(segment.id)}
                      disabled={isLast}
                      className={cn(
                        "text-13 tracking-tight truncate max-w-[160px] transition-colors rounded-md px-1.5 py-0.5",
                        isLast
                          ? "font-semibold text-foreground cursor-default"
                          : "text-foreground hover:bg-muted cursor-pointer font-normal"
                      )}
                      title={segment.name}
                    >
                      {segment.name}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ProjectTopbarSwitcher>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-64 border border-border bg-background" : "w-8 hover:bg-muted cursor-pointer"
          )}
          onClick={expandSearch}
        >
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 shrink-0",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0 text-muted-foreground"
                : "left-1/2 -translate-x-1/2 text-foreground"
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search files & folders..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => collapseSearch(searchQuery)}
            className={cn(
              "h-full text-sm py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-8",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer rounded-sm"
            >
              <Plus className="size-3.5 rotate-45 shrink-0" />
            </button>
          )}
        </div>

        {/* View Toggle and Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted p-1 rounded-md">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "relative p-1.5 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  view === v
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label={`${v} view`}
              >
                {view === v && (
                  <motion.div
                    layoutId="view-toggle"
                    className="absolute inset-0 bg-background rounded-md shadow-xs"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex">
                  {v === 'grid' && <Columns3 className="size-4 shrink-0" strokeWidth={1.75} />}
                  {v === 'list' && <AlignJustify className="size-4 shrink-0" strokeWidth={1.75} />}
                </span>
              </button>
            ))}
          </div>
          <StorageFilterPopover />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 px-3 rounded-md cursor-pointer">
              <Plus className="size-3.5 text-primary-foreground shrink-0" />
              <span>New</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1 rounded-md border border-border bg-popover ">
            <button
              onClick={handleUploadFile}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <Upload className="size-4 text-foreground shrink-0" />
              <span>Upload file</span>
            </button>
            <button
              onClick={handleUploadFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <FolderUp className="size-4 text-foreground shrink-0" />
              <span>Upload folder</span>
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <FolderPlus className="size-4 text-foreground shrink-0" />
              <span>New folder</span>
            </button>
          </PopoverContent>
        </Popover>

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
        //@ts-ignore - webkitdirectory is non-standard but supported in all modern browsers
        webkitdirectory="true"
        multiple
        onChange={handleFolderSelect}
      />

      {projectId && (
        <CreateFolderModal projectId={projectId} parentId={parentId} />
      )}
      <RenameModal />
      <MoveModal projectId={projectId} />
      <DuplicateModal
        isOpen={duplicatePrompt !== null}
        filename={duplicatePrompt?.file.name ?? ""}
        onConfirm={(mode) => duplicatePrompt?.resolve(mode)}
        onClose={() => duplicatePrompt?.resolve("cancel")}
      />
    </header>
  );
}
