import React from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/shared/lib/utils";
import {
  Search,
  Plus,
  Upload,
  FolderUp,
  FolderPlus,
  Columns3,
  AlignJustify,
  ListFilter,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Check,
  Home,
  Folder,
  Users,
  Star,
  Trash,
} from 'lucide-react';
import { StorageIcon } from '@/shared/components/icons';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import { useTopbar } from '../../hooks/use-topbar';
import CreateFolderModal from '../modal/CreateFolderModal';
import RenameModal from '../modal/RenameModal';
import DuplicateModal from '../modal/DuplicateModal';
import MoveModal from '../modal/MoveModal';
import { useViewStore } from '../../store/use-view-store';
import { StorageFilterPopover } from '../filters/StorageFilterPopover';
import StorageQuotaWidget from './StorageQuotaWidget';

import { useStorageUIStore, type StorageSection } from '../../store/storage-ui.store';

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

const STORAGE_NAV_SECTIONS: { label: string; icon: any; section: StorageSection }[] = [
  { label: 'Home', icon: Home, section: 'home' },
  { label: 'All Files', icon: Folder, section: 'my-files' },
  { label: 'Shared', icon: Users, section: 'shared' },
  { label: 'Starred', icon: Star, section: 'starred' },
  { label: 'Trash', icon: Trash, section: 'trash' },
];

export default function Topbar({
  title,
  icon: Icon = StorageIcon,
  breadcrumbs,
  onBreadcrumbNavigate,
  searchQuery = "",
  onSearchChange,
  projectId,
  parentId,
  children,
  className,
}: TopbarProps) {
  const activeSection = useStorageUIStore((s) => s.activeSection);
  const navigateToSection = useStorageUIStore((s) => s.navigateToSection);

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

  const isSubfolder = Boolean(breadcrumbs && breadcrumbs.length > 1);
  const currentFolderName = isSubfolder ? breadcrumbs![breadcrumbs!.length - 1]?.name : title || 'All Files';

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border bg-transparent px-3 sm:px-4 h-11 sticky top-0 z-10 shrink-0 select-none relative',
        className
      )}
      style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
    >
      {/* Title & Navigation / Breadcrumbs */}
      <div className="flex items-center gap-1.5 min-w-0 max-w-[50vw] sm:max-w-[55vw]">
        {isSubfolder ? (
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-1 no-scrollbar">
            {/* Mobile Back Button */}
            <button
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

            {Icon && <Icon className="size-4 text-foreground shrink-0 mr-1" />}
            {breadcrumbs!.map((segment, index) => {
              const isLast = index === breadcrumbs!.length - 1;
              return (
                <div key={segment.id || `root-${index}`} className="flex items-center gap-1 min-w-0 shrink-0">
                  {index > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <button
                    onClick={() => onBreadcrumbNavigate?.(segment.id)}
                    disabled={isLast}
                    className={cn(
                      "text-xs sm:text-sm tracking-tight truncate max-w-[90px] sm:max-w-[160px] transition-colors rounded-md px-1 py-0.5",
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
        ) : (
          <>
            {/* Mobile Section Selector Dropdown */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer outline-none group border border-transparent hover:border-border">
                    {Icon && <Icon className="size-4 text-primary shrink-0" />}
                    <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate max-w-[120px]">
                      {title || 'All Files'}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover z-50">
                  <div className="px-2.5 py-1 text-10 font-semibold uppercase tracking-wider text-muted-foreground">
                    Storage
                  </div>
                  {STORAGE_NAV_SECTIONS.map((sec) => {
                    const isActive = activeSection === sec.section;
                    const SecIcon = sec.icon;
                    return (
                      <DropdownMenuItem
                        key={sec.section}
                        onClick={() => navigateToSection(sec.section)}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <SecIcon className="size-4 shrink-0" />
                          <span>{sec.label}</span>
                        </div>
                        {isActive && <Check className="size-3.5 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="my-1" />
                  <div className="p-2">
                    <StorageQuotaWidget compact={false} className="border-0 bg-transparent p-0 shadow-none" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop View Title */}
            <div className="hidden md:flex items-center gap-2">
              {Icon && <Icon className="size-4 text-foreground shrink-0" />}
              <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200 truncate">
                {title || 'My Files'}
              </h1>
            </div>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Desktop Search Bar */}
        <div
          className={cn(
            "relative hidden md:flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-60 border border-border bg-background" : "w-8 hover:bg-muted cursor-pointer"
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
              "h-full text-xs sm:text-sm py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-8",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer rounded-sm"
              aria-label="Clear search"
            >
              <Plus className="size-3.5 rotate-45 shrink-0" />
            </button>
          )}
        </div>

        {/* Mobile Search Toggle Button */}
        <button
          onClick={expandSearch}
          className={cn(
            "flex md:hidden size-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer",
            searchQuery ? "border-primary bg-muted text-primary" : ""
          )}
          aria-label="Search"
        >
          <Search className="size-4 shrink-0" />
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
              className="flex-1 bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="p-1 text-muted-foreground hover:text-foreground mr-1"
                aria-label="Clear query"
              >
                <Plus className="size-3.5 rotate-45 shrink-0" />
              </button>
            )}
            <button
              onClick={() => collapseSearch(searchQuery)}
              className="text-xs text-primary font-medium px-1.5 py-1 rounded hover:bg-muted"
            >
              Done
            </button>
          </div>
        )}

        {/* View Toggle and Filter */}
        <div className="flex items-center gap-1 sm:gap-2">
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center bg-muted p-0.5 sm:p-1 rounded-md">
              {(['grid', 'list'] as const).map((v) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView(v)}
                      className={cn(
                        "relative p-1 sm:p-1.5 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary",
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
                        {v === 'grid' && <Columns3 className="size-3.5 sm:size-4 shrink-0" strokeWidth={1.75} />}
                        {v === 'list' && <AlignJustify className="size-3.5 sm:size-4 shrink-0" strokeWidth={1.75} />}
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

        {/* New Button / Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 px-2.5 sm:px-3 rounded-md cursor-pointer shrink-0">
              <Plus className="size-3.5 text-primary-foreground shrink-0" />
              <span className="text-xs font-medium">New</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-48 p-1.5 rounded-xl border border-border bg-popover shadow-xl z-50"
          >
            <button
              onClick={handleUploadFile}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs sm:text-sm rounded-lg hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <Upload className="size-4 text-foreground shrink-0" />
              <span>Upload file</span>
            </button>
            <button
              onClick={handleUploadFolder}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs sm:text-sm rounded-lg hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
            >
              <FolderUp className="size-4 text-foreground shrink-0" />
              <span>Upload folder</span>
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs sm:text-sm rounded-lg hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
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

      <CreateFolderModal projectId={projectId} parentId={parentId} />
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
