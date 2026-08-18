'use client';

import React, { useState, useRef, useEffect } from "react";
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
  Link2,
  PanelLeft,
} from "lucide-react";
import { useLibrarySidebarStore } from "@/features/workspaces/library/store/sidebar.store";
import {
  Input,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";

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
  onAddPaper?: (mode?: 'file' | 'folder' | 'link') => void;
  onAddCollection?: () => void;
  onAddLink?: () => void;
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
  onAddPaper,
  onAddCollection,
  onAddLink,
  isSubcollection = false,
  onNavigateCrumb,
  children,
  className,
}: TopbarProps) {
  const { isOpen, toggle } = useLibrarySidebarStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  const handleAddFileClick = () => {
    if (onAddPaper) onAddPaper('file');
  };

  const handleAddFolderClick = () => {
    if (onAddPaper) onAddPaper('folder');
  };

  const handleAddLinkClick = () => {
    if (onAddLink) {
      onAddLink();
    } else if (onAddPaper) {
      onAddPaper('link');
    }
  };

  // Keyboard shortcut Ctrl/Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (onSearchChange !== undefined) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border/50 bg-transparent px-6 h-14 sticky top-0 z-10 shrink-0 select-none",
        className
      )}
    >
      {/* Left Section: Title or Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        {!isOpen && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expand sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-muted/80 cursor-pointer transition-colors outline-none mr-0.5 shrink-0"
                >
                  <PanelLeft className="size-4.5 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb.id || idx}>
                    {idx > 0 && (
                      <ChevronRight className="size-3.5 text-foreground/50 shrink-0" />
                    )}
                    <div className="flex items-center justify-center shrink-0">
                      <MoreHorizontal className="size-4 text-foreground/60" />
                    </div>
                  </React.Fragment>
                );
              }

              const isLast = idx === breadcrumbs.length - 1;

              return (
                <React.Fragment key={crumb.id || idx}>
                  {idx > 0 && (
                    <ChevronRight className="size-3.5 text-foreground/50 shrink-0" />
                  )}
                  <div
                    role={!isLast && onNavigateCrumb ? "button" : undefined}
                    tabIndex={!isLast && onNavigateCrumb ? 0 : undefined}
                    className={cn(
                      "flex items-center gap-2 min-w-0",
                      !isLast && onNavigateCrumb
                        ? "cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-primary rounded"
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
                    <FolderOpen className="size-4 text-foreground shrink-0" />
                    <span
                      className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200 truncate max-w-[120px] sm:max-w-[200px]"
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
            {Icon && <Icon className="size-4.5 text-foreground shrink-0" />}
            {title && (
              <h1 className="text-base font-semibold tracking-tight text-foreground transition-colors duration-200 truncate">
                {title}
              </h1>
            )}
          </div>
        )}
      </div>

      {/* Right Section: Search & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Search Input */}
        {onSearchChange !== undefined && (
          <div className="relative flex items-center w-48 sm:w-60 h-8 rounded-md border border-border/50 bg-background/60 hover:bg-background focus-within:bg-background focus-within:border-primary/50 transition-colors">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearchChange('');
                }
              }}
              className="h-full text-xs py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 pl-8 pr-7"
            />
            {search && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45" />
              </button>
            )}
          </div>
        )}

        {/* + New Button with Dropdown Popover */}
        {(onAddPaper || onAddCollection) && (
          <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 px-3 rounded-lg cursor-pointer font-medium text-xs">
                <Plus className="size-3.5 text-primary-foreground" />
                <span>New</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-52 p-1 shadow-md border-border/60"
            >
              {onAddPaper && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleAddFileClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
                >
                  <FileText className="size-3.5 text-foreground" />
                  <span>Add File...</span>
                </button>
              )}
              {onAddPaper && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleAddFolderClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
                >
                  <FolderUp className="size-3.5 text-foreground" />
                  <span>Add Folder...</span>
                </button>
              )}
              {onAddCollection && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onAddCollection();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
                >
                  <FolderPlus className="size-3.5 text-foreground" />
                  <span>{isSubcollection ? "Add Subcollection..." : "Add Collection..."}</span>
                </button>
              )}
              {onAddPaper && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleAddLinkClick();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors text-left text-foreground cursor-pointer"
                >
                  <Link2 className="size-3.5 text-foreground" />
                  <span>Add Link to File...</span>
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {children}
      </div>
    </header>
  );
}
