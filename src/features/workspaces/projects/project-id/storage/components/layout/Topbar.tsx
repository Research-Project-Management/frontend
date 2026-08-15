'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { HardDrive, Search, Plus, Upload, FolderUp, FolderPlus, Columns3, AlignJustify, ListFilter } from 'lucide-react';
import { Input, Button, Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui";
import { useTopbar } from '../../hooks/use-topbar';
import CreateFolderModal from '../modals/CreateFolderModal';
import RenameModal from '../modals/RenameModal';
import DuplicateModal from '../modals/DuplicateModal';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';

interface TopbarProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
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
        'flex h-12 w-full items-center justify-between border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur-md sticky top-0 z-10 shrink-0',
        className
      )}
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate font-semibold tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-lg overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
          )}
          onClick={expandSearch}
        >
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0 text-muted-foreground/50"
                : "left-1/2 -translate-x-1/2 text-muted-foreground group-hover:text-foreground"
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => collapseSearch(searchQuery)}
            className={cn(
              "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Plus className="size-3.5 rotate-45" />
            </button>
          )}
        </div>

        {/* View Toggle and Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted p-1 rounded-lg">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "relative p-1.5 rounded-md transition-colors",
                  view === v
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label={`${v} view`}
              >
                {view === v && (
                  <motion.div
                    layoutId="view-toggle"
                    className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex">
                  {v === 'grid' && <Columns3 className="size-4" strokeWidth={2.5} />}
                  {v === 'list' && <AlignJustify className="size-4" strokeWidth={2.5} />}
                </span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="size-8 rounded-lg bg-transparent border-border/60">
            <ListFilter className="size-4 text-muted-foreground" strokeWidth={2.5} />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 px-3 rounded-lg">
              <Plus className="size-3.5" />
              New
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <button
              onClick={handleUploadFile}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
            >
              <Upload className="size-4 text-muted-foreground" />
              Upload file
            </button>
            <button
              onClick={handleUploadFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
            >
              <FolderUp className="size-4 text-muted-foreground" />
              Upload folder
            </button>
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
            >
              <FolderPlus className="size-4 text-muted-foreground" />
              New folder
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
      <DuplicateModal
        isOpen={duplicatePrompt !== null}
        filename={duplicatePrompt?.file.name ?? ""}
        onConfirm={(mode) => duplicatePrompt?.resolve(mode)}
        onClose={() => duplicatePrompt?.resolve("cancel")}
      />
    </header>
  );
}
