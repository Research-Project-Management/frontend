'use client';

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import {
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Search,
  Plus,
  FileText,
  FileUp,
  FolderUp,
  FolderPlus,
  FolderInput,
  Link2,
  PanelRight,
  FilePlus2,
  Wand2,
  Book,
  BookOpen,
  Users,
  ScrollText,
  FileBarChart,
  GraduationCap,
  Globe,
  Database,
  PenLine,
  Scale,
  Bookmark,
  Presentation,
  Code2,
  Newspaper,
  File,
  Briefcase,
  Music,
  Video,
  Mic,
  UserCheck,
  Map,
  Palette,
} from "lucide-react";
import { LibraryIcon } from "@/shared/components/icons";
import { Button, Input } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { LibraryFilterPopover } from "./LibraryFilterPopover";
import { LibraryDisplayPopover, type LibraryDisplayOptions } from "./LibraryDisplayPopover";
import { useLibrarySidebarStore } from "../store/sidebar.store";
import type { Item } from "../types/library.types";

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
  showDisplay?: boolean;
  displayOptions?: LibraryDisplayOptions;
  onDisplayOptionsChange?: (options: LibraryDisplayOptions) => void;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  items?: Item[];
  onAddPaper?: (mode?: 'file' | 'folder' | 'link') => void;
  onNewManualItem?: (itemType: string) => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onDirectFolderUpload?: (files: File[], folderName: string) => void;
  onAddCollection?: () => void;
  onAddLink?: () => void;
  onImportFromPersonal?: () => void;
  isSubcollection?: boolean;
  onNavigateCrumb?: (crumbId?: string) => void;
  showInspectorToggle?: boolean;
  onToggleInspector?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title,
  icon: Icon = LibraryIcon,
  breadcrumbs,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search references...",
  showFilter = true,
  showDisplay = true,
  displayOptions,
  onDisplayOptionsChange,
  scopeId: propScopeId,
  projectId: propProjectId,
  workspaceId: propWorkspaceId,
  items,
  onAddPaper,
  onNewManualItem,
  onDirectFilesUpload,
  onDirectFolderUpload,
  onAddCollection,
  onAddLink,
  onImportFromPersonal,
  isSubcollection = false,
  onNavigateCrumb,
  showInspectorToggle = true,
  onToggleInspector,
  children,
  className,
}: TopbarProps) {
  const { isInspectorOpen, toggleInspector } = useLibrarySidebarStore();
  const params = useParams() as { collectionId?: string };
  const effectiveScopeId = propScopeId || propProjectId || propWorkspaceId || 'user';

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
              <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
            )}
          </div>
        )}
      </div>

      {/* Right Section: Search & Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Search Input (Standard expandable library search) */}
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
                "h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 placeholder:font-normal transition-opacity duration-200 pl-7 pr-7 text-foreground",
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted transition-colors cursor-pointer p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45 shrink-0" />
              </button>
            )}
          </div>
        )}

        {/* Academic Library Multi-Criteria Filter */}
        {showFilter && (
          <LibraryFilterPopover scopeId={effectiveScopeId} items={items} />
        )}

        {/* Academic Library Display Options */}
        {showDisplay && displayOptions && onDisplayOptionsChange && (
          <LibraryDisplayPopover
            options={displayOptions}
            onOptionsChange={onDisplayOptionsChange}
          />
        )}

        {/* + New Button with Dropdown Menu (Includes Import from My Library when in Project scope) */}
        {(onNewManualItem || onAddPaper || onAddCollection || onDirectFilesUpload || onDirectFolderUpload || onAddLink || onImportFromPersonal) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 px-3 rounded-md cursor-pointer font-medium text-13 shadow-none inline-flex items-center justify-center">
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
            >
              {/* Group 1: Create Reference (Manual Reference Creation - Zotero Standard) */}
              {onNewManualItem && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                    <PenLine className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="text-foreground">Create Reference</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    collisionPadding={16}
                    sideOffset={4}
                    alignOffset={-4}
                    className="w-52 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
                  >
                    {/* Top 9 Academic Quick List */}
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('journalArticle')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <FileText className="size-3.5 text-foreground shrink-0" />
                      <span>Journal Article</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('book')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <Book className="size-3.5 text-foreground shrink-0" />
                      <span>Book</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('bookSection')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <BookOpen className="size-3.5 text-foreground shrink-0" />
                      <span>Book Section</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('conferencePaper')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <Users className="size-3.5 text-foreground shrink-0" />
                      <span>Conference Paper</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('preprint')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <ScrollText className="size-3.5 text-foreground shrink-0" />
                      <span>Preprint</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('report')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <FileBarChart className="size-3.5 text-foreground shrink-0" />
                      <span>Report</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('thesis')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <GraduationCap className="size-3.5 text-foreground shrink-0" />
                      <span>Thesis</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('webpage')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <Globe className="size-3.5 text-foreground shrink-0" />
                      <span>Web Page</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onNewManualItem('dataset')}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <Database className="size-3.5 text-foreground shrink-0" />
                      <span>Dataset</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="mx-1 my-1" />

                    {/* Zotero Standard "More Types..." Submenu (Clean Flat List A-Z) */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted">
                        <MoreHorizontal className="size-3.5 text-foreground shrink-0" />
                        <span>More Types...</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent
                        collisionPadding={16}
                        sideOffset={4}
                        alignOffset={-4}
                        className="w-56 max-h-[min(380px,var(--radix-dropdown-menu-content-available-height,calc(100vh-64px)))] overflow-y-auto overflow-x-hidden p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
                      >
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('artwork')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Palette className="size-3.5 text-foreground shrink-0" />
                          <span>Artwork</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('audioRecording')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Music className="size-3.5 text-foreground shrink-0" />
                          <span>Audio Recording</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('bill')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <FileText className="size-3.5 text-foreground shrink-0" />
                          <span>Bill</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('blogPost')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Globe className="size-3.5 text-foreground shrink-0" />
                          <span>Blog Post</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('case')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Briefcase className="size-3.5 text-foreground shrink-0" />
                          <span>Case</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('computerProgram')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Code2 className="size-3.5 text-foreground shrink-0" />
                          <span>Computer Program</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('dictionaryEntry')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Book className="size-3.5 text-foreground shrink-0" />
                          <span>Dictionary Entry</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('document')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <File className="size-3.5 text-foreground shrink-0" />
                          <span>Document</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('encyclopediaArticle')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <BookOpen className="size-3.5 text-foreground shrink-0" />
                          <span>Encyclopedia Article</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('film')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Video className="size-3.5 text-foreground shrink-0" />
                          <span>Film</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('forumPost')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Globe className="size-3.5 text-foreground shrink-0" />
                          <span>Forum Post</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('hearing')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Users className="size-3.5 text-foreground shrink-0" />
                          <span>Hearing</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('interview')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <UserCheck className="size-3.5 text-foreground shrink-0" />
                          <span>Interview</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('magazineArticle')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <FileText className="size-3.5 text-foreground shrink-0" />
                          <span>Magazine Article</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('manuscript')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <ScrollText className="size-3.5 text-foreground shrink-0" />
                          <span>Manuscript</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('map')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Map className="size-3.5 text-foreground shrink-0" />
                          <span>Map</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('newspaperArticle')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Newspaper className="size-3.5 text-foreground shrink-0" />
                          <span>Newspaper Article</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('patent')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Scale className="size-3.5 text-foreground shrink-0" />
                          <span>Patent</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('podcast')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Mic className="size-3.5 text-foreground shrink-0" />
                          <span>Podcast</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('presentation')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Presentation className="size-3.5 text-foreground shrink-0" />
                          <span>Presentation</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('standard')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Bookmark className="size-3.5 text-foreground shrink-0" />
                          <span>Standard</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('statute')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Scale className="size-3.5 text-foreground shrink-0" />
                          <span>Statute</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('tvBroadcast')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Video className="size-3.5 text-foreground shrink-0" />
                          <span>TV Broadcast</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onNewManualItem('videoRecording')}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <Video className="size-3.5 text-foreground shrink-0" />
                          <span>Video Recording</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* Group 2: Add by Identifier (Magic Wand) */}
              {(onAddLink || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddLinkClick}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Wand2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Add by Identifier</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="mx-1 my-1" />

              {/* Group 3: File & Folder Upload */}
              {(onDirectFilesUpload || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddFileClick}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FileUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Upload Files</span>
                </DropdownMenuItem>
              )}
              {(onDirectFolderUpload || onAddPaper) && (
                <DropdownMenuItem
                  onClick={handleAddFolderClick}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FolderUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Upload Folder</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="mx-1 my-1" />

              {/* Group 4: Collection / Structure Creation */}
              {onAddCollection && (
                <DropdownMenuItem
                  onClick={onAddCollection}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">{isSubcollection ? "New Subcollection" : "New Collection"}</span>
                </DropdownMenuItem>
              )}

              {/* Group 5: Project Ingestion from Personal Library */}
              {onImportFromPersonal && (
                <DropdownMenuItem
                  onClick={onImportFromPersonal}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FolderInput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Import from My Library</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {children}

        {/* Line dọc ngăn cách giữa button New và icon đóng mở: mỏng 1px, h-4 căn giữa quang học, cách xa biên trên dưới */}
        {showInspectorToggle && !isInspectorOpen && (
          <div className="flex items-center gap-1 shrink-0 ml-0.5">
            <div className="h-4 border-l border-border shrink-0" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleInspector || toggleInspector}
                  className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0"
                  aria-label="Expand inspector"
                >
                  <PanelRight className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm">
                Expand inspector
              </TooltipContent>
            </Tooltip>
          </div>
        )}

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
