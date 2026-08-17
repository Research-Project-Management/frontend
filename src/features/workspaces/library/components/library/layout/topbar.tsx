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
  PanelLeftOpen,
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
  _id: string;
  name: string;
  color?: string;
  isEllipsis?: boolean;
}

export interface TopbarProps {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  breadcrumbs?: BreadcrumbItem[];
  onNavigateCrumb?: (id: string) => void;
  onAddPaper?: (mode?: 'file' | 'folder' | 'link') => void;
  onAddCollection?: () => void;
  onAddLink?: () => void;
  isSubcollection?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title = "Library",
  icon: Icon = BookOpen,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search papers...",
  breadcrumbs,
  onNavigateCrumb,
  onAddPaper,
  onAddCollection,
  onAddLink,
  isSubcollection = false,
  children,
  className,
}: TopbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isOpen, toggle } = useLibrarySidebarStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const collapseSearch = () => {
    if (!search) {
      setIsSearchExpanded(false);
    }
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange?.("");
    setIsSearchExpanded(false);
  };

  // Keyboard shortcut (Cmd+K / Ctrl+K or /) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      if (!isInput && onSearchChange) {
        if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
          e.preventDefault();
          setIsSearchExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

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

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border/50 bg-background/80 px-6 h-14 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none",
        className
      )}
    >
      {/* Left Section: Title or Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        {!isOpen && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expand sidebar"
                  className="flex size-7 items-center justify-center rounded-md text-foreground hover:text-foreground hover:bg-secondary/80 transition-colors mr-0.5 shrink-0 cursor-pointer outline-none"
                >
                  <PanelLeftOpen className="size-4 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumbs" className="flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb._id || idx}>
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
                <React.Fragment key={crumb._id || idx}>
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
                        onNavigateCrumb(crumb._id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        !isLast &&
                        onNavigateCrumb &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        onNavigateCrumb(crumb._id);
                      }
                    }}
                  >
                    <FolderOpen className="size-4.5 text-foreground shrink-0" />
                    <span
                      className="text-[1.05rem] font-semibold tracking-tight text-foreground transition-colors duration-200 truncate max-w-[200px]"
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
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="size-4.5 text-foreground shrink-0" />}
            {title && (
              <h1 className="text-[1.05rem] font-semibold tracking-tight text-foreground transition-colors duration-200 truncate">
                {title}
              </h1>
            )}
          </div>
        )}
      </div>

      {/* Right Section: Search & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Expandable Search Input */}
        {onSearchChange !== undefined && (
          <div
            className={cn(
              "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-lg overflow-hidden group",
              isSearchExpanded || search
                ? "w-64 border border-border/50 bg-background"
                : "w-8 hover:bg-secondary/80 cursor-pointer"
            )}
            onClick={expandSearch}
          >
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground",
                isSearchExpanded || search
                  ? "left-2.5 translate-x-0"
                  : "left-1/2 -translate-x-1/2"
              )}
            />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={collapseSearch}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearchChange('');
                  setIsSearchExpanded(false);
                }
              }}
              className={cn(
                "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8",
                isSearchExpanded || search ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              autoFocus={isSearchExpanded}
            />
            {(isSearchExpanded || search) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearSearch}
                className="absolute right-2.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45 text-foreground" />
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
