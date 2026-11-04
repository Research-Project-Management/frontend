'use client';

import React, { useState, useCallback } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { libraryIllustrationStyles, StarredStackIllustration, TrashStackIllustration, RetractedStackIllustration, UnfiledStackIllustration, PublicationsStackIllustration, CollectionStackIllustration, AllReferencesStackIllustration, SearchStackIllustration, FeedStackIllustration, FeedAllReadIllustration, RecentlyReadVerticalStackIllustration } from '@/features/library/ui/content/LibraryIllustrations';

export interface ItemTableHeaderProps {
  columns: Record<string, boolean>;
  isTrash?: boolean;
  isAllSelected: boolean;
  onSelectAll: () => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
}

export function ItemTableHeader({
  columns,
  isTrash = false,
  isAllSelected,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
}: ItemTableHeaderProps) {
  const renderSortIndicator = (key: string) => {
    if (sortColumn !== key) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    ) : (
      <ArrowDown className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    );
  };

  const getAriaSort = (key: string): React.AriaAttributes['aria-sort'] => {
    if (sortColumn !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <thead className="sticky top-0 z-10 bg-background select-none">
      <tr className="h-8 text-foreground font-medium text-12">
        <th
          scope="col"
          className="pl-1.5 pr-3 h-8 py-0 align-middle font-medium select-none text-left bg-background border-b border-border"
        >
          <div className="flex items-center gap-1.5 w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectAll();
                    }
                  }}
                  aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
                  className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Checkbox
                    checked={isAllSelected}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {isAllSelected ? 'Deselect all' : 'Select all'}
              </TooltipContent>
            </Tooltip>
            <button
              type="button"
              onClick={() => onSort('title')}
              aria-sort={getAriaSort('title')}
              className="flex items-center gap-1.5 cursor-pointer min-w-0 text-foreground text-12 font-medium bg-transparent border-0 p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
            >
              <span>Title</span>
              {renderSortIndicator('title')}
            </button>
          </div>
        </th>

        {columns.authors !== false && (
          <th
            scope="col"
            aria-sort={getAriaSort('authors')}
            onClick={() => onSort('authors')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('authors');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Authors</span>
              {renderSortIndicator('authors')}
            </div>
          </th>
        )}

        {columns.year !== false && (
          <th
            scope="col"
            aria-sort={getAriaSort('year')}
            onClick={() => onSort('year')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('year');
              }
            }}
            tabIndex={0}
            className="px-2 h-8 py-0 align-middle text-center font-medium cursor-pointer text-foreground select-none bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Year</span>
              {renderSortIndicator('year')}
            </div>
          </th>
        )}

        {columns.publication !== false && (
          <th
            scope="col"
            aria-sort={getAriaSort('publicationTitle')}
            onClick={() => onSort('publicationTitle')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('publicationTitle');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Publication</span>
              {renderSortIndicator('publicationTitle')}
            </div>
          </th>
        )}

        {columns.itemType && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Type
          </th>
        )}

        {columns.doi && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            DOI
          </th>
        )}

        {columns.citationKey && (
          <th
            scope="col"
            aria-sort={getAriaSort('citationKey')}
            onClick={() => onSort('citationKey')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('citationKey');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Citation Key</span>
              {renderSortIndicator('citationKey')}
            </div>
          </th>
        )}

        {columns.citations && (
          <th
            scope="col"
            className="px-2 h-8 py-0 align-middle text-center font-medium text-foreground select-none bg-background border-b border-border"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Citations</span>
            </div>
          </th>
        )}

        {isTrash && (
          <th
            scope="col"
            aria-sort={getAriaSort('deletedAt')}
            onClick={() => onSort('deletedAt')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('deletedAt');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Date Deleted</span>
              {renderSortIndicator('deletedAt')}
            </div>
          </th>
        )}

        <th
          scope="col"
          aria-label="Actions"
          className="w-11 px-1 h-8 py-0 align-middle bg-background border-b border-border"
        />
      </tr>
    </thead>
  );
}

export default ItemTableHeader;

export { RecentlyReadVerticalStackIllustration };

/**
 * RecentlyReadEmptyState
 * Pure Flat Precision / Plane.so style empty state for Recently Read.
 * Strictly contains NO action buttons, seamless default background, and
 * authentic 3D isometric illustration.
 */
export function RecentlyReadEmptyState() {
  return (
    <div
      data-testid="recently-read-empty"
      className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none"
    >
      <style dangerouslySetInnerHTML={{ __html: libraryIllustrationStyles }} />

      <div className="plane-library-illustration mb-6 flex items-center justify-center">
        <RecentlyReadVerticalStackIllustration />
      </div>

      <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        No recently read references
      </h3>

      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
        Papers and literature you open or read will appear here for quick
        access.
      </p>
    </div>
  );
}

export interface LibraryEmptyStateProps {
  search?: string;
  activeFilter?: string | null;
  collectionId?: string;
  collectionName?: string;
  canEdit?: boolean;
  onDirectFilesUpload?: (files: File[]) => void;
  className?: string;
  title?: string;
  description?: string;
  illustration?: React.ComponentType<{ className?: string }>;
}

type EmptyStateVariant =
  | 'recently-read'
  | 'search'
  | 'trash'
  | 'starred'
  | 'retracted'
  | 'unfiled'
  | 'my-publications'
  | 'saved-search'
  | 'collection'
  | 'feed'
  | 'feed-unread'
  | 'feed-read'
  | 'default';

interface EmptyStateConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  showDropzone: boolean;
}

interface DefaultLibraryEmptyStateProps extends Omit<LibraryEmptyStateProps, 'activeFilter'> {
  variant: EmptyStateVariant;
}

function DefaultLibraryEmptyState({
  search = '',
  collectionName,
  canEdit = true,
  onDirectFilesUpload,
  variant,
  title,
  description,
  illustration,
  className,
}: DefaultLibraryEmptyStateProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const getConfig = (): EmptyStateConfig => {
    if (title) {
      return {
        illustration: illustration ?? (variant === 'search' ? SearchStackIllustration : CollectionStackIllustration),
        title,
        description: description ?? (variant === 'search' ? `No records found matching "${search}".` : 'No documents in this collection yet.'),
        showDropzone: false,
      };
    }

    switch (variant) {
      case 'feed':
        return {
          illustration: FeedStackIllustration,
          title: 'No RSS feeds subscribed',
          description: 'Stay updated with preprints and peer-reviewed articles by subscribing to feeds.',
          showDropzone: false,
        };
      case 'feed-unread':
        return {
          illustration: FeedAllReadIllustration,
          title: 'All caught up!',
          description: 'You have read all articles in this feed.',
          showDropzone: false,
        };
      case 'feed-read':
        return {
          illustration: FeedStackIllustration,
          title: 'No read articles',
          description: 'Articles you read in this feed will be listed here.',
          showDropzone: false,
        };
      case 'search':
        return {
          illustration: SearchStackIllustration,
          title: 'No matching references',
          description: `No records found matching "${search}". Try checking for spelling errors or searching with broader keywords.`,
          showDropzone: false,
        };
      case 'trash':
        return {
          illustration: TrashStackIllustration,
          title: 'Trash is empty',
          description: 'Deleted references from your library appear here before permanent deletion.',
          showDropzone: false,
        };
      case 'starred':
        return {
          illustration: StarredStackIllustration,
          title: 'No starred references',
          description: 'Star papers and references to keep important academic literature within quick reach.',
          showDropzone: false,
        };
      case 'retracted':
        return {
          illustration: RetractedStackIllustration,
          title: 'No retracted items',
          description: 'No retraction notices or security alerts detected across your literature repository.',
          showDropzone: false,
        };
      case 'unfiled':
        return {
          illustration: UnfiledStackIllustration,
          title: 'No unfiled references',
          description: 'All references in your library are neatly organized into collections.',
          showDropzone: false,
        };
      case 'my-publications':
        return {
          illustration: PublicationsStackIllustration,
          title: 'No publications yet',
          description: 'Keep track of your authored, co-authored, and published scientific contributions in one place.',
          showDropzone: true,
        };
      case 'saved-search':
        return {
          illustration: SearchStackIllustration,
          title: 'No matching records',
          description: 'No references match the active filter criteria of this saved search.',
          showDropzone: false,
        };
      case 'collection':
        return {
          illustration: CollectionStackIllustration,
          title: collectionName ? `${collectionName} is empty` : 'Collection is empty',
          description: 'Drag references here or import files directly into this research collection.',
          showDropzone: true,
        };
      case 'default':
      default:
        return {
          illustration: AllReferencesStackIllustration,
          title: 'Start with your first reference',
          description: 'Upload PDF papers, import BibTeX or RIS files, or add references via DOI to build your academic library.',
          showDropzone: true,
        };
    }
  };

  const config = getConfig();
  const IllustrationComponent = config.illustration;

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || !onDirectFilesUpload || !config.showDropzone) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [canEdit, onDirectFilesUpload, config.showDropzone],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || !onDirectFilesUpload || !config.showDropzone) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDirectFilesUpload(Array.from(e.dataTransfer.files));
      }
    },
    [canEdit, onDirectFilesUpload, config.showDropzone],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none transition-colors',
        config.showDropzone && canEdit && isDragOver && 'border-2 border-dashed border-primary bg-primary/5 ring-1 ring-primary',
        className,
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: libraryIllustrationStyles }} />

      <IllustrationComponent className="plane-illustration mb-6 shrink-0" />

      <h2 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {config.title}
      </h2>

      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
        {config.description}
      </p>
    </div>
  );
}

export function LibraryEmptyState(props: LibraryEmptyStateProps) {
  const pathname = usePathname();
  const search = props.search || '';
  const activeFilter = props.activeFilter || null;

  const isSearchActive = Boolean(search.trim());
  const isRecent =
    activeFilter === 'recent' ||
    activeFilter === 'recently-read' ||
    pathname?.includes('/recently-read');

  if (isRecent && !isSearchActive) {
    return <RecentlyReadEmptyState />;
  }

  const variant: EmptyStateVariant = (() => {
    if (isSearchActive) return 'search';
    if (isRecent) return 'recently-read';
    if (activeFilter === 'trash') return 'trash';
    if (activeFilter === 'starred') return 'starred';
    if (activeFilter === 'retracted') return 'retracted';
    if (activeFilter === 'unfiled') return 'unfiled';
    if (activeFilter === 'my-publications') return 'my-publications';
    if (activeFilter === 'saved-search') return 'saved-search';
    if (activeFilter === 'feed' || activeFilter === 'feeds') return 'feed';
    if (activeFilter === 'feed-unread') return 'feed-unread';
    if (activeFilter === 'feed-read') return 'feed-read';
    if (props.collectionId) return 'collection';
    return 'default';
  })();

  return <DefaultLibraryEmptyState {...props} variant={variant} />;
}
