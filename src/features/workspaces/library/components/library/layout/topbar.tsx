'use client';

import React, { useState, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import {
  BookOpen,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Search,
  Plus,
  Upload,
  FolderPlus,
  PanelLeftOpen,
} from "lucide-react";
import { useLibrarySidebarStore } from "@/features/workspaces/library/store/sidebar.store";
import {
  Input,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
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
  onAddPaper?: () => void;
  onAddCollection?: () => void;
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

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border/50 bg-background/80 px-6 h-14 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none",
        className
      )}
    >
      {/* Left Section: Title or Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        {!isOpen && (
          <button
            onClick={toggle}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors mr-0.5 shrink-0"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb._id || idx}>
                    {idx > 0 && (
                      <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                    )}
                    <div className="flex items-center justify-center shrink-0">
                      <MoreHorizontal className="size-4 text-muted-foreground/60" />
                    </div>
                  </React.Fragment>
                );
              }

              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb._id || idx}>
                  {idx > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                  <div
                    role={!isLast && onNavigateCrumb ? "button" : undefined}
                    tabIndex={!isLast && onNavigateCrumb ? 0 : undefined}
                    className={cn(
                      "flex items-center gap-2 min-w-0",
                      !isLast && onNavigateCrumb
                        ? "cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
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
                    <FolderOpen className="size-4.5 text-muted-foreground shrink-0" />
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
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="size-4.5 text-muted-foreground shrink-0" />}
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
        {/* Expandable Search Input (matching Storage Topbar) */}
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
                "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10",
                isSearchExpanded || search
                  ? "left-2.5 translate-x-0 text-muted-foreground/50"
                  : "left-1/2 -translate-x-1/2 text-muted-foreground group-hover:text-foreground"
              )}
            />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={collapseSearch}
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
                className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
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
              <Button size="sm" className="h-8 gap-1.5 px-3 rounded-lg">
                <Plus className="size-3.5" />
                New
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              {onAddPaper && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onAddPaper();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
                >
                  <Upload className="size-4 text-muted-foreground" />
                  Add paper
                </button>
              )}
              {onAddCollection && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onAddCollection();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
                >
                  <FolderPlus className="size-4 text-muted-foreground" />
                  {isSubcollection ? "New subcollection" : "New collection"}
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
