'use client';

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import {
  BookOpen,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Search,
  Plus,
  FileText,
  FolderUp,
  FolderPlus,
  FolderInput,
  Link2,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import TagFilterPopover from "./TagSelector";

export interface BreadcrumbItem {
  id?: string;
  name: string;
  isEllipsis?: boolean;
}

export interface TopbarProps {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbs?: BreadcrumbItem[];
  search?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  showFilter?: boolean;
  workspaceId?: string;
  onAddPaper?: (mode?: 'file' | 'folder' | 'link') => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onDirectFolderUpload?: (files: File[], folderName: string) => void;
  onAddCollection?: () => void;
  onAddLink?: () => void;
  onImportFromPersonal?: () => void;
  isSubcollection?: boolean;
  onNavigateCrumb?: (crumbId?: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title,
  icon: Icon = BookOpen,
  breadcrumbs,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search references...",
  showFilter = true,
  workspaceId: propWorkspaceId,
  onAddPaper,
  onDirectFilesUpload,
  onDirectFolderUpload,
  onAddCollection,
  onAddLink,
  onImportFromPersonal,
  isSubcollection = false,
  onNavigateCrumb,
  children,
  className,
}: TopbarProps) {
  const params = useParams() as { collectionId?: string };
  const effectiveWorkspaceId = propWorkspaceId || 'user';

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);
  const directFolderInputRef = useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    setIsSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const collapseSearch = (query: string) => {
    if (!query) {
      setIsSearchExpanded(false);
    }
  };

  const handleClearSearch = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onSearchChange) {
      onSearchChange("");
    }
    setIsSearchExpanded(false);
  };

  const handleAddFileClick = () => {
    if (onDirectFilesUpload && directFileInputRef.current) {
      directFileInputRef.current.click();
    } else if (onAddPaper) {
      onAddPaper('file');
    }
  };

  const handleAddFolderClick = () => {
    if (onDirectFolderUpload && directFolderInputRef.current) {
      directFolderInputRef.current.click();
    } else if (onAddPaper) {
      onAddPaper('folder');
    }
  };

  const handleAddLinkClick = () => {
    if (onAddLink) {
      onAddLink();
    } else if (onAddPaper) {
      onAddPaper('link');
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border bg-background px-4 h-11 sticky top-0 z-10 shrink-0 select-none",
        className
      )}
    >
      {/* Left Section: Title / Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb.id || idx}>
                    {idx > 0 && (
                      <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <div className="flex items-center justify-center shrink-0">
                      <MoreHorizontal className="size-4 text-muted-foreground shrink-0" />
                    </div>
                  </React.Fragment>
                );
              }

              const isLast = idx === breadcrumbs.length - 1;

              return (
                <React.Fragment key={crumb.id || idx}>
                  {idx > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                  <div
                    role={!isLast && onNavigateCrumb ? "button" : undefined}
                    tabIndex={!isLast && onNavigateCrumb ? 0 : undefined}
                    className={cn(
                      "flex items-center gap-2 min-w-0",
                      !isLast && onNavigateCrumb
                        ? "cursor-pointer hover:underline focus-visible:outline-none rounded-sm"
                        : ""
                    )}
                    onClick={() => {
                      if (!isLast && onNavigateCrumb) {
                        onNavigateCrumb(crumb.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        !isLast &&
                        onNavigateCrumb &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        onNavigateCrumb(crumb.id);
                      }
                    }}
                  >
                    <FolderOpen className={cn("size-4 shrink-0 transition-colors", isLast ? "text-foreground" : "text-muted-foreground")} />
                    <span
                      className={cn(
                        "text-13 tracking-tight transition-colors truncate max-w-[120px] sm:max-w-[200px]",
                        !isLast
                          ? "text-muted-foreground font-normal"
                          : "text-foreground font-medium"
                      )}
                      title={crumb.name}
                    >
                      {crumb.name}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="size-4 text-foreground shrink-0" />}
            {title && (
              <h1 className="text-sub font-medium tracking-tight text-foreground truncate">
                {title}
              </h1>
            )}
          </div>
        )}
      </div>

      {/* Right Section: Search & Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Search Input (Standard expandable workspace search) */}
        {onSearchChange !== undefined && (
          <div
            className={cn(
              "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group",
              isSearchExpanded || search
                ? "w-64 border border-border bg-background"
                : "w-8 hover:bg-muted cursor-pointer"
            )}
            onClick={expandSearch}
          >
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 shrink-0",
                isSearchExpanded || search
                  ? "left-2 translate-x-0 text-muted-foreground"
                  : "left-1/2 -translate-x-1/2 text-muted-foreground"
              )}
            />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => collapseSearch(search)}
              className={cn(
                "h-full text-xs font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 placeholder:font-normal transition-opacity duration-200 pl-7 pr-7 text-foreground",
                isSearchExpanded || search ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              autoFocus={isSearchExpanded}
            />
            {(isSearchExpanded || search) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted transition-colors cursor-pointer p-0.5 rounded-sm"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45 shrink-0" />
              </button>
            )}
          </div>
        )}

        {/* Tag Filter Popover Button */}
        {showFilter && (
          <TagFilterPopover workspaceId={effectiveWorkspaceId} />
        )}

        {/* + New Button with Dropdown Menu (Includes Import from My Library when in Project scope) */}
        {(onAddPaper || onAddCollection || onDirectFilesUpload || onDirectFolderUpload || onAddLink || onImportFromPersonal) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 px-3 rounded-md cursor-pointer font-medium text-12">
                <Plus className="size-4 text-primary-foreground shrink-0" />
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-none space-y-0.5"
            >
              {/* Group 1: Collection / Structure Creation */}
              {onAddCollection && (
                <DropdownMenuItem
                  onClick={onAddCollection}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">{isSubcollection ? "New Subcollection" : "New Collection"}</span>
                </DropdownMenuItem>
              )}

              {onAddCollection && (onDirectFilesUpload || onDirectFolderUpload || onAddPaper || onAddLink) && (
                <DropdownMenuSeparator className="my-1 bg-border" />
              )}

              {/* Group 2: External Ingestion (File, Folder, Link) */}
              {(onDirectFilesUpload || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddFileClick}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Add file</span>
                </DropdownMenuItem>
              )}
              {(onDirectFolderUpload || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddFolderClick}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <FolderUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Add folder</span>
                </DropdownMenuItem>
              )}
              {(onAddLink || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddLinkClick}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Link2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Add link</span>
                </DropdownMenuItem>
              )}

              {/* Group 3: Project Ingestion from Personal Library */}
              {onImportFromPersonal && (
                <>
                  <DropdownMenuSeparator className="my-1 bg-border" />
                  <DropdownMenuItem
                    onClick={onImportFromPersonal}
                    className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <FolderInput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="text-foreground">Import from My Library...</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {children}

        {/* Hidden Direct File Input */}
        <input
          ref={directFileInputRef}
          type="file"
          accept=".pdf,application/pdf,.bib,.bibtex,.ris,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              onDirectFilesUpload?.(files);
            }
            e.target.value = '';
          }}
        />

        {/* Hidden Direct Folder Input */}
        <input
          ref={directFolderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            const allFiles = Array.from(e.target.files || []);
            const pdfFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
            const folderName = pdfFiles[0]?.webkitRelativePath?.split('/')[0] || 'Selected Folder';
            if (pdfFiles.length > 0) {
              onDirectFolderUpload?.(pdfFiles, folderName);
            }
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
