'use client';

import React, { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  MoreHorizontal,
  Search,
  FileText,
  FileUp,
  FolderUp,
  FolderPlus,
  FolderInput,
  PanelLeft,
  PanelRight,
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
  Trash2,
} from 'lucide-react';
import {
  LibraryIcon,
  ZoteroLineIcon,
  MendeleyLineIcon,
} from '@/shared/components/icons';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LibraryFilterPopover } from './LibraryFilterPopover';
import { LibraryDisplayPopover, type LibraryDisplayOptions } from './LibraryDisplayPopover';
import { TopbarSearch } from './TopbarSearch';
import {
  useLibrarySidebarStore,
  useLibraryViewStore,
  useLibraryModalStore,
  useLibraryUIStore,
} from '../../store';
import type { Item } from '../../types/library.types';

export interface BreadcrumbItem {
  id?: string;
  name: string;
  isEllipsis?: boolean;
}

export interface TopbarProps {
  title?: string;
  count?: number;
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
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
  showInspectorToggle?: boolean;
  onToggleInspector?: () => void;
  canEdit?: boolean;
  isTrash?: boolean;
  onEmptyTrash?: () => void;
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
  searchPlaceholder = 'Search references...',
  showSidebarToggle = true,
  onToggleSidebar,
  showFilter = true,
  showDisplay = true,
  displayOptions: propDisplayOptions,
  onDisplayOptionsChange: propOnDisplayOptionsChange,
  scopeId: propScopeId,
  projectId: propProjectId,
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
  canEdit = true,
  isTrash = false,
  onEmptyTrash,
  children,
  className,
}: TopbarProps) {
  const {
    isOpen,
    toggle,
    isInspectorOpen,
    toggleInspector,
    activeScope,
  } = useLibrarySidebarStore();
  const handleToggleSidebar = onToggleSidebar || toggle;
  const isEffectiveCanEdit =
    canEdit &&
    (activeScope.type === 'personal' ||
      (activeScope.role !== 'reviewer' &&
        activeScope.role !== 'viewer' &&
        activeScope.role !== 'commenter'));
  const activeItemId = useLibraryViewStore((s) => s.activeItemId);
  const openModal = useLibraryModalStore((s) => s.openModal);
  const storeDisplayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setStoreDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);

  const effectiveDisplayOptions = propDisplayOptions ?? storeDisplayOptions;
  const effectiveOnDisplayOptionsChange =
    propOnDisplayOptionsChange ?? setStoreDisplayOptions;

  const router = useRouter();
  const params = useParams() as { collectionId?: string };

  const effectiveScopeId =
    propScopeId ||
    propProjectId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const displayTitle =
    title ||
    (activeScope.type === 'personal' ? 'Library' : activeScope.name) ||
    'Library';

  const Icon = propIcon !== undefined ? propIcon : (isTrash ? Trash2 : LibraryIcon);

  const directFileInputRef = useRef<HTMLInputElement>(null);
  const directFolderInputRef = useRef<HTMLInputElement>(null);

  const handleAddFileClick = () => {
    openModal('UPLOAD_FILES', { collectionId: params?.collectionId });
  };

  const handleAddFolderClick = () => {
    if (onDirectFolderUpload && directFolderInputRef.current) {
      directFolderInputRef.current.click();
    } else {
      openModal('UPLOAD_FILES', { collectionId: params?.collectionId });
    }
  };

  const handleAddLinkClick = () => {
    if (onAddLink) {
      onAddLink();
    } else if (onAddPaper) {
      onAddPaper('link');
    } else {
      openModal('IMPORT_PAPER');
    }
  };

  const handleCreateCollectionClick = () => {
    if (onAddCollection) {
      onAddCollection();
    } else {
      openModal('CREATE_COLLECTION');
    }
  };

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border bg-transparent px-3 sm:px-4 h-11 sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0',
        className
      )}
      style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
    >
      {/* Left Section: Breadcrumbs / Title */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0 mr-2">
        {showSidebarToggle && !isOpen && (
          <div className="flex items-center gap-1.5 -ml-1 mr-0.5">
            <Tooltip delayDuration={700}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleSidebar}
                  className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
              >
                Expand sidebar
              </TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          </div>
        )}

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              if (crumb.isEllipsis) {
                return (
                  <React.Fragment key={crumb.id || idx}>
                    {idx > 0 && (
                      <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
                    )}
                    <div className="flex items-center justify-center shrink-0">
                      <MoreHorizontal className="size-4 text-foreground shrink-0" />
                    </div>
                  </React.Fragment>
                );
              }

              const isLast = idx === breadcrumbs.length - 1;

              return (
                <React.Fragment key={crumb.id || idx}>
                  {idx > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
                  )}
                  {!isLast && onNavigateCrumb ? (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 h-7 px-1.5 rounded-md text-13 font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 select-none text-left"
                      onClick={() => onNavigateCrumb(crumb.id)}
                    >
                      {idx === 0 && Icon && (
                        <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                      )}
                      <span
                        className="text-13 tracking-tight truncate max-w-[120px] sm:max-w-[180px] font-medium text-foreground"
                        title={crumb.name}
                      >
                        {crumb.name}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 h-7 px-1 min-w-0 select-none shrink-0">
                      {idx === 0 && Icon && (
                        <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                      )}
                      <h1
                        className="text-13 font-medium tracking-tight text-foreground truncate max-w-[200px] sm:max-w-[320px]"
                        title={crumb.name}
                      >
                        {crumb.name}
                      </h1>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2 h-7 px-1 min-w-0 select-none shrink-0">
            {Icon && <Icon className="size-4 text-foreground shrink-0" strokeWidth={1.5} />}
            <h1 className="text-13 font-medium tracking-tight text-foreground truncate">
              {displayTitle}
            </h1>
          </div>
        )}
      </div>

      {/* Center Section: Search */}
      <div className="flex items-center gap-2.5 shrink-0">
        <TopbarSearch
          placeholder={searchPlaceholder}
          value={search}
          onChange={onSearchChange}
          onClear={onSearchChange ? () => onSearchChange('') : undefined}
        />

        {/* Academic Library Multi-Criteria Filter */}
        {showFilter && (
          <LibraryFilterPopover scopeId={effectiveScopeId} items={items} />
        )}

        {/* Academic Library Display Options */}
        {showDisplay && effectiveDisplayOptions && effectiveOnDisplayOptionsChange && (
          <LibraryDisplayPopover
            options={effectiveDisplayOptions}
            onOptionsChange={effectiveOnDisplayOptionsChange}
            isTrash={isTrash}
          />
        )}

        {children}

        {/* Empty Trash Button or New Item Dropdown Menu */}
        {isTrash && isEffectiveCanEdit && onEmptyTrash ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onEmptyTrash}
            disabled={count === 0}
            className={cn(
              "h-8 px-3 rounded-md font-medium text-13 inline-flex items-center justify-center transition-colors",
              count === 0
                ? "opacity-50 cursor-not-allowed border-border text-muted-foreground"
                : "cursor-pointer text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/60"
            )}
          >
            <span>Empty Trash</span>
          </Button>
        ) : isEffectiveCanEdit && !isTrash ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3 rounded-md cursor-pointer font-medium text-13 shadow-none inline-flex items-center justify-center"
              >
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none space-y-0.5"
            >
              <DropdownMenuItem
                onClick={handleAddLinkClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Wand2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-foreground">Add by Identifier</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleAddFileClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <FileUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-foreground">Upload Files</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleAddFolderClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <FolderUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-foreground">Upload Folder</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                  <PenLine className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Manual Entry</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  collisionPadding={16}
                  sideOffset={4}
                  alignOffset={-4}
                  className="w-52 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
                >
                  {[
                    { type: 'journalArticle', label: 'Journal Article', icon: FileText },
                    { type: 'book', label: 'Book', icon: Book },
                    { type: 'bookSection', label: 'Book Section', icon: BookOpen },
                    { type: 'conferencePaper', label: 'Conference Paper', icon: Users },
                    { type: 'preprint', label: 'Preprint', icon: ScrollText },
                    { type: 'report', label: 'Report', icon: FileBarChart },
                    { type: 'thesis', label: 'Thesis', icon: GraduationCap },
                    { type: 'webpage', label: 'Web Page', icon: Globe },
                    { type: 'dataset', label: 'Dataset', icon: Database },
                  ].map(({ type, label, icon: TypeIcon }) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => {
                        if (onNewManualItem) onNewManualItem(type);
                        else openModal('IMPORT_PAPER');
                      }}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                    >
                      <TypeIcon className="size-3.5 text-foreground shrink-0" />
                      <span>{label}</span>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuSeparator className="mx-1 my-1" />

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
                      {[
                        { type: 'artwork', label: 'Artwork', icon: Palette },
                        { type: 'audioRecording', label: 'Audio Recording', icon: Music },
                        { type: 'bill', label: 'Bill', icon: FileText },
                        { type: 'blogPost', label: 'Blog Post', icon: Globe },
                        { type: 'case', label: 'Case', icon: Briefcase },
                        { type: 'computerProgram', label: 'Software', icon: Code2 },
                        { type: 'dictionaryEntry', label: 'Dictionary Entry', icon: Book },
                        { type: 'document', label: 'Document', icon: File },
                        { type: 'encyclopediaArticle', label: 'Encyclopedia Article', icon: BookOpen },
                        { type: 'film', label: 'Film', icon: Video },
                        { type: 'forumPost', label: 'Forum Post', icon: Globe },
                        { type: 'hearing', label: 'Hearing', icon: Users },
                        { type: 'interview', label: 'Interview', icon: UserCheck },
                        { type: 'magazineArticle', label: 'Magazine Article', icon: FileText },
                        { type: 'manuscript', label: 'Manuscript', icon: ScrollText },
                        { type: 'map', label: 'Map', icon: Map },
                        { type: 'newspaperArticle', label: 'Newspaper Article', icon: Newspaper },
                        { type: 'patent', label: 'Patent', icon: Scale },
                        { type: 'podcast', label: 'Podcast', icon: Mic },
                        { type: 'presentation', label: 'Presentation', icon: Presentation },
                        { type: 'standard', label: 'Standard', icon: Bookmark },
                        { type: 'statute', label: 'Statute', icon: Scale },
                        { type: 'tvBroadcast', label: 'TV Broadcast', icon: Video },
                        { type: 'videoRecording', label: 'Video Recording', icon: Video },
                      ].map(({ type, label, icon: MoreIcon }) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => {
                            if (onNewManualItem) onNewManualItem(type);
                            else openModal('IMPORT_PAPER');
                          }}
                          className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                        >
                          <MoreIcon className="size-3.5 text-foreground shrink-0" />
                          <span>{label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="mx-1 my-1" />

              <DropdownMenuItem
                onClick={handleCreateCollectionClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-foreground">
                  {isSubcollection ? 'New Subcollection' : 'New Collection'}
                </span>
              </DropdownMenuItem>

              {onImportFromPersonal && (
                <DropdownMenuItem
                  onClick={onImportFromPersonal}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FolderInput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground">Import from My Library</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="mx-1 my-1" />

              <DropdownMenuItem
                onClick={() => {
                  router.push('/settings/integrations?provider=zotero');
                }}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <ZoteroLineIcon className="size-4 text-foreground shrink-0" />
                <span className="text-foreground">Zotero Sync...</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  router.push('/settings/integrations?provider=mendeley');
                }}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <MendeleyLineIcon className="size-4 text-foreground shrink-0" />
                <span className="text-foreground">Mendeley Sync...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <PanelRight className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
              >
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

export { LibraryTopbar as Topbar };
export default LibraryTopbar;
