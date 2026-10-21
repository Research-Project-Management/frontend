"use client";

import React, { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import {
  Check,
  CheckCheck,
  ChevronRight,
  Folder,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Rss,
  Search,
  Trash2,
} from "lucide-react";
import { LibraryIcon } from "@/shared/components/icons";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { LibraryFilterPopover } from "./LibraryFilterPopover";
import {
  LibraryDisplayPopover,
  type LibraryDisplayOptions,
} from "./LibraryDisplayPopover";
import { TopbarSearch } from "./TopbarSearch";
import { TopbarNewItemDropdown } from "./TopbarNewItemDropdown";
import { TopbarNewFeedDropdown } from "./TopbarNewFeedDropdown";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useLibraryPermissions } from "@/features/library/core/coordinator/permissions.coordinator";
import type { Item } from "@/features/library/domain/types/library.types";

export interface BreadcrumbSwitcherOption {
  id: string;
  name: string;
  isActive?: boolean;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}

export interface BreadcrumbItem {
  id?: string;
  name: string;
  isEllipsis?: boolean;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  clickable?: boolean;
  switcherOptions?: BreadcrumbSwitcherOption[];
  switcherPlaceholder?: string;
  onSelectSwitcherOption?: (id: string) => void;
}

function BreadcrumbChevronSwitcher({
  options,
  placeholder = "Find...",
  onSelect,
  defaultIcon: DefaultOptionIcon = Folder,
}: {
  options: BreadcrumbSwitcherOption[];
  placeholder?: string;
  onSelect: (id: string) => void;
  defaultIcon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? options.filter((opt) =>
        opt.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group/chevron flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground transition-colors cursor-pointer outline-none shrink-0"
          aria-label="Switch item"
        >
          <ChevronRight
            className="size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]/chevron:rotate-90"
            strokeWidth={1.5}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-64 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none"
      >
        <div
          className="flex items-center gap-2 px-2 h-8 mb-1 rounded-md bg-muted/60 border border-border/60"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-none">
          {filtered.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-12 text-muted-foreground">
              No results found
            </div>
          ) : (
            filtered.map((opt) => {
              const OptIcon = opt.icon || DefaultOptionIcon;
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 gap-2.5 px-2.5 text-13 whitespace-nowrap cursor-pointer rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors flex items-center justify-between",
                    opt.isActive
                      ? "font-medium text-foreground bg-muted/60"
                      : "font-normal text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <OptIcon
                      className="size-3.5 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{opt.name}</span>
                  </div>
                  {opt.isActive && (
                    <Check
                      className="size-3.5 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TopbarProps {
  title?: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  breadcrumbs?: BreadcrumbItem[];
  search?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  showFilter?: boolean;
  showDisplay?: boolean;
  displayOptions?: LibraryDisplayOptions;
  onDisplayOptionsChange?: (options: LibraryDisplayOptions) => void;
  scopeId?: string;
  items?: Item[];
  onAddPaper?: (mode?: "file" | "folder" | "link") => void;
  onNewManualItem?: (itemType: string) => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onDirectFolderUpload?: (files: File[], folderName: string) => void;
  onAddCollection?: () => void;
  onAddLink?: () => void;
  onImportFromUser?: () => void;
  isSubcollection?: boolean;
  onNavigateCrumb?: (crumbId?: string) => void;
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
  showInspectorToggle?: boolean;
  onToggleInspector?: () => void;
  canEdit?: boolean;
  isTrash?: boolean;
  onEmptyTrash?: () => void;
  isFeed?: boolean;
  onRefreshFeed?: () => void;
  onMarkAllFeedRead?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export type LibraryTopbarProps = TopbarProps;

/**
 * LibraryTopbar Zone
 * Modern autonomous topbar supporting standalone Workspace mode and injected Page mode.
 */
export function LibraryTopbar({
  title,
  count,
  icon: propIcon,
  breadcrumbs,
  search,
  onSearchChange,
  searchPlaceholder = "Search references...",
  showSidebarToggle = true,
  onToggleSidebar,
  showFilter = true,
  showDisplay = true,
  displayOptions: propDisplayOptions,
  onDisplayOptionsChange: propOnDisplayOptionsChange,
  scopeId: propScopeId,
  items,
  onAddPaper,
  onNewManualItem,
  onDirectFilesUpload,
  onDirectFolderUpload,
  onAddCollection,
  onAddLink,
  onImportFromUser,
  isSubcollection = false,
  onNavigateCrumb,
  showInspectorToggle = true,
  onToggleInspector,
  canEdit = true,
  isTrash = false,
  onEmptyTrash,
  isFeed = false,
  onRefreshFeed,
  onMarkAllFeedRead,
  children,
  className,
}: TopbarProps) {
  const isSidebarOpen = useLibraryUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useLibraryUIStore((s) => s.toggleSidebar);
  const isInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const toggleInspector = useLibraryUIStore((s) => s.toggleInspector);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const handleToggleSidebar = onToggleSidebar || toggleSidebar;
  const { canEditItem } = useLibraryPermissions();
  const isEffectiveCanEdit = canEdit && canEditItem;
  const openModal = useLibraryUIStore((s) => s.openModal);
  const storeDisplayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setStoreDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);

  const effectiveDisplayOptions = propDisplayOptions ?? storeDisplayOptions;
  const effectiveOnDisplayOptionsChange =
    propOnDisplayOptionsChange ?? setStoreDisplayOptions;

  const params = useParams() as { collectionId?: string };
  const activeCollectionId = params?.collectionId;

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === "project" ? activeScope.id : "user");

  const displayTitle =
    title ||
    (activeScope.type === "user" ? "My Library" : activeScope.name) ||
    "My Library";

  const RootIcon = activeScope.type === "project" ? Folder : LibraryIcon;
  const Icon =
    propIcon !== undefined ? propIcon : isTrash ? Trash2 : LibraryIcon;

  const directFileInputRef = useRef<HTMLInputElement>(null);
  const directFolderInputRef = useRef<HTMLInputElement>(null);

  const handleAddFileClick = () => {
    openModal("UPLOAD_PDF", { collectionId: params?.collectionId });
  };

  const handleAddFolderClick = () => {
    if (onDirectFolderUpload && directFolderInputRef.current) {
      directFolderInputRef.current.click();
    } else {
      openModal("UPLOAD_PDF", { collectionId: params?.collectionId });
    }
  };

  const handleAddLinkClick = () => {
    if (onAddLink) {
      onAddLink();
    } else if (onAddPaper) {
      onAddPaper("link");
    } else {
      openModal("ADD_BY_IDENTIFIER");
    }
  };

  const handleCreateCollectionClick = () => {
    if (onAddCollection) {
      onAddCollection();
    } else {
      openModal("CREATE_COLLECTION", {
        parentId: params?.collectionId || null,
      });
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border bg-transparent px-3 sm:px-4 h-11 sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0",
        className,
      )}
      style={{ paddingLeft: "max(0.75rem, var(--header-offset, 0px))" }}
    >
      {/* Left Section: Breadcrumbs / Title */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0 mr-2">
        {showSidebarToggle && !isSidebarOpen && (
          <div className="flex items-center gap-1.5 -ml-1 mr-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleSidebar}
                  className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0 relative before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft
                    className="size-4 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          </div>
        )}

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav
            aria-label="Breadcrumbs"
            className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden"
          >
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb.id || idx}>
                    {idx > 0 && (
                      <ChevronRight
                        className="size-3.5 text-foreground shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                    <div className="flex items-center justify-center shrink-0">
                      <MoreHorizontal className="size-4 text-foreground shrink-0" />
                    </div>
                  </React.Fragment>
                );
              }

              const isLast = idx === breadcrumbs.length - 1;
              const isCrumbClickable = !isLast && onNavigateCrumb && crumb.clickable !== false;

              return (
                <React.Fragment key={crumb.id || idx}>
                  {idx > 0 && (
                    crumb.switcherOptions && crumb.switcherOptions.length > 0 && crumb.onSelectSwitcherOption ? (
                      <BreadcrumbChevronSwitcher
                        options={crumb.switcherOptions}
                        placeholder={crumb.switcherPlaceholder || (isFeed ? "Find feed..." : "Find collection...")}
                        onSelect={crumb.onSelectSwitcherOption}
                        defaultIcon={isFeed ? Rss : Folder}
                      />
                    ) : (
                      <ChevronRight
                        className="size-3.5 text-foreground shrink-0"
                        strokeWidth={1.5}
                      />
                    )
                  )}
                  {isCrumbClickable ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 h-7 px-1.5 rounded-md text-13 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 select-none text-left relative before:absolute before:-inset-1.5 md:before:hidden"
                          onClick={() => onNavigateCrumb(crumb.id)}
                        >
                          {crumb.icon ? (
                            <crumb.icon
                              className="size-4 shrink-0 text-foreground"
                              strokeWidth={1.5}
                            />
                          ) : idx === 0 ? (
                            <RootIcon
                              className="size-4 shrink-0 text-foreground"
                              strokeWidth={1.5}
                            />
                          ) : null}
                          <span className="text-13 tracking-tight truncate max-w-[120px] sm:max-w-[180px] font-medium text-foreground">
                            {crumb.name}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6}>
                        {crumb.name}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="flex items-center gap-2 h-7 px-1 min-w-0 select-none shrink-0">
                      {crumb.icon ? (
                        <crumb.icon
                          className="size-4 shrink-0 text-foreground"
                          strokeWidth={1.5}
                        />
                      ) : idx === 0 ? (
                        <RootIcon
                          className="size-4 shrink-0 text-foreground"
                          strokeWidth={1.5}
                        />
                      ) : (
                        (() => {
                          const PropIcon = propIcon;
                          return PropIcon ? (
                            <PropIcon
                              className="size-4 shrink-0 text-foreground"
                              strokeWidth={1.5}
                            />
                          ) : null;
                        })()
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-13 font-medium tracking-tight text-foreground truncate max-w-[200px] sm:max-w-[320px]">
                            {crumb.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6}>
                          {crumb.name}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2 h-7 px-1 min-w-0 select-none shrink-0">
            {Icon && (
              <Icon
                className="size-4 text-foreground shrink-0"
                strokeWidth={1.5}
              />
            )}
            <span className="text-13 font-medium tracking-tight text-foreground truncate">
              {displayTitle}
            </span>
          </div>
        )}
      </div>

      {/* Center Section: Search */}
      <div className="flex items-center gap-2.5 shrink-0">
        <TopbarSearch
          placeholder={isFeed ? "Search feed articles..." : searchPlaceholder}
          value={search}
          onChange={onSearchChange}
          onClear={onSearchChange ? () => onSearchChange("") : undefined}
        />

        {/* Academic Library Multi-Criteria Filter */}
        {showFilter && !isFeed && (
          <LibraryFilterPopover scopeId={effectiveScopeId} items={items} />
        )}

        {/* Academic Library Display Options */}
        {showDisplay &&
          !isFeed &&
          effectiveDisplayOptions &&
          effectiveOnDisplayOptionsChange && (
            <LibraryDisplayPopover
              options={effectiveDisplayOptions}
              onOptionsChange={effectiveOnDisplayOptionsChange}
              isTrash={isTrash}
            />
          )}

        {children}

        {/* Empty Trash Button, Feed Refresh Button, or New Item Dropdown Menu */}
        {isTrash && isEffectiveCanEdit && onEmptyTrash ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onEmptyTrash}
            disabled={count === 0}
            className={cn(
              "h-8 px-3 rounded-md font-medium text-13 inline-flex items-center gap-1.5 transition-colors shadow-none",
              count === 0
                ? "opacity-50 cursor-not-allowed border-border text-muted-foreground"
                : "cursor-pointer border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30",
            )}
          >
            <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>Empty Trash</span>
          </Button>
        ) : isFeed ? (
          <div className="flex items-center gap-1.5">
            {/* Centralized New Feed Action Dropdown */}
            {isEffectiveCanEdit && (
              <TopbarNewFeedDropdown
                onRefreshFeed={onRefreshFeed}
                onMarkAllFeedRead={onMarkAllFeedRead}
              />
            )}
          </div>
        ) : isEffectiveCanEdit && !isTrash && !isFeed ? (
          <TopbarNewItemDropdown
            scopeId={effectiveScopeId}
            activeCollectionId={activeCollectionId}
            isSubcollection={isSubcollection}
            onAddLinkClick={handleAddLinkClick}
            onAddFileClick={handleAddFileClick}
            onAddFolderClick={handleAddFolderClick}
            onCreateCollectionClick={handleCreateCollectionClick}
            onNewManualItem={onNewManualItem}
            onImportFromUser={onImportFromUser}
            openModal={openModal}
          />
        ) : null}

        {/* Inspector Toggle Button with preceding divider line - Hidden when panel is open */}
        {showInspectorToggle && !isInspectorOpen && (
          <div className="flex items-center gap-1 ml-0.5 -mr-1 sm:-mr-2">
            <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleInspector || toggleInspector}
                  className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0"
                  aria-label="Open inspector"
                >
                  <PanelRight
                    className="size-4 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={6}>
                Expand panel
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
            e.target.value = "";
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
            const pdfFiles = allFiles.filter((f) =>
              f.name.toLowerCase().endsWith(".pdf"),
            );
            const folderName =
              pdfFiles[0]?.webkitRelativePath?.split("/")[0] ||
              "Selected Folder";
            if (pdfFiles.length > 0) {
              onDirectFolderUpload?.(pdfFiles, folderName);
            }
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}

export { LibraryTopbar as Topbar };
export default LibraryTopbar;
