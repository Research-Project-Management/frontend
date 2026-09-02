import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { HardDrive, Search, Plus, Upload, FolderUp, FolderPlus, Columns3, AlignJustify, ListFilter, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useTopbar } from '../../hooks/use-topbar';
import CreateFolderModal from '../modal/CreateFolderModal';
import RenameModal from '../modal/RenameModal';
import DuplicateModal from '../modal/DuplicateModal';
import MoveModal from '../modal/MoveModal';
import { useViewStore } from '../../store/use-view-store';
import { StorageFilterPopover } from '../filters/StorageFilterPopover';

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
  workspaceId?: string;
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
  workspaceId,
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
  } = useTopbar({ searchQuery, onSearchChange, workspaceId, parentId });

  const { view, setView } = useViewStore();

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border/50 bg-background/80 px-4 h-11 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none',
        className
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 max-w-[55vw]">
        {breadcrumbs && breadcrumbs.length > 1 ? (
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-1">
            {Icon && <Icon className="size-4 text-foreground/80 shrink-0 mr-1" />}
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={segment.id || `root-${index}`} className="flex items-center gap-1 min-w-0 shrink-0">
                  {index > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                  <button
                    onClick={() => onBreadcrumbNavigate?.(segment.id)}
                    disabled={isLast}
                    className={cn(
                      "text-sm tracking-tight truncate max-w-[160px] transition-colors rounded px-1 py-0.5",
                      isLast
                        ? "font-semibold text-foreground cursor-default"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer"
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
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-4 text-foreground/80" />}
            <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">
              {title || 'All Files'}
            </h1>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
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
            placeholder="Search files & folders..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => collapseSearch(searchQuery)}
            className={cn(
              "h-full text-sm py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8",
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
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center bg-muted p-1 rounded-lg">
              {(['grid', 'list'] as const).map((v) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView(v)}
                      className={cn(
                        "relative p-1.5 rounded-md transition-colors cursor-pointer",
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
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {v === 'grid' ? 'Grid view' : 'List view'}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            <StorageFilterPopover />
          </TooltipProvider>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 px-3 rounded-lg cursor-pointer shadow-sm">
              <Plus className="size-3.5 text-primary-foreground" />
              <span>New</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-52 p-1.5 shadow-lg"
          >
            <button
              onClick={handleUploadFile}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <Upload className="size-4 text-primary" />
              <span>Upload file</span>
            </button>
            <button
              onClick={handleUploadFolder}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <FolderUp className="size-4 text-primary" />
              <span>Upload folder</span>
            </button>
            <div className="h-px bg-border/50 my-1" />
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <FolderPlus className="size-4 text-emerald-500" />
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

      {workspaceId && (
        <CreateFolderModal workspaceId={workspaceId} parentId={parentId} />
      )}
      <RenameModal />
      <MoveModal workspaceId={workspaceId} />
      <DuplicateModal
        isOpen={duplicatePrompt !== null}
        filename={duplicatePrompt?.file.name ?? ""}
        onConfirm={(mode) => duplicatePrompt?.resolve(mode)}
        onClose={() => duplicatePrompt?.resolve("cancel")}
      />
    </header>
  );
}
