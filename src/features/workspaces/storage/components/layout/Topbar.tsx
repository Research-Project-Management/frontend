import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { HardDrive, Search, Plus, Upload, FolderUp, FolderPlus, Columns3, AlignJustify, ListFilter } from 'lucide-react';
import { Input, Button, Popover, PopoverTrigger, PopoverContent, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import { useTopbar } from '../../hooks/use-topbar';
import CreateFolderModal from '../modal/CreateFolderModal';
import RenameModal from '../modal/RenameModal';
import DuplicateModal from '../modal/DuplicateModal';
import { useViewStore } from '../../store/use-view-store';

interface TopbarProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  workspaceId?: string;
  parentId?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title,
  icon: Icon = HardDrive,
  searchQuery = "",
  onSearchChange,
  workspaceId,
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
        'flex items-center justify-between border-b border-border/50 bg-background/80 px-6 h-14 backdrop-blur-md sticky top-0 z-10 shrink-0',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-foreground/80" />}
        <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">
          {title}
        </h1>
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
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0"
                : "left-1/2 -translate-x-1/2"
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
              className="absolute right-2.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3.5 rotate-45 text-foreground" />
            </button>
          )}
        </div>

        {/* View Toggle and Filter */}
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center bg-muted p-1 rounded-lg">
              {(['grid', 'list'] as const).map((v) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView(v)}
                      className={cn(
                        "relative p-1.5 rounded-md transition-colors cursor-pointer outline-none",
                        view === v 
                          ? "text-foreground" 
                          : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                      )}
                      aria-label={`${v === 'grid' ? 'Grid' : 'List'} view`}
                    >
                      {view === v && (
                        <motion.div
                          layoutId="view-toggle"
                          className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-md"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex">
                        {v === 'grid' && <Columns3 className="size-4 text-foreground" strokeWidth={2.5} />}
                        {v === 'list' && <AlignJustify className="size-4 text-foreground" strokeWidth={2.5} />}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {v === 'grid' ? 'Grid view' : 'List view'}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="size-8 rounded-lg bg-transparent border-border/60 cursor-pointer outline-none" aria-label="Filter">
                  <ListFilter className="size-4 text-foreground" strokeWidth={2.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Filter
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 px-3 rounded-lg cursor-pointer">
              <Plus className="size-3.5 text-primary-foreground" />
              New
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-48 p-1"
          >
            <button
              onClick={handleUploadFile}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left cursor-pointer"
            >
              <Upload className="size-4 text-foreground" />
              Upload file
            </button>
            <button
              onClick={handleUploadFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left cursor-pointer"
            >
              <FolderUp className="size-4 text-foreground" />
              Upload folder
            </button>
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left cursor-pointer"
            >
              <FolderPlus className="size-4 text-foreground" />
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

      {workspaceId && (
        <CreateFolderModal workspaceId={workspaceId} parentId={parentId} />
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
