'use client';

import React, { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { RecentlyReadEmptyState } from './RecentlyReadEmptyState';
import {
  libraryIllustrationStyles,
  StarredStackIllustration,
  TrashStackIllustration,
  RetractedStackIllustration,
  UnfiledStackIllustration,
  PublicationsStackIllustration,
  CollectionStackIllustration,
  AllReferencesStackIllustration,
  SearchStackIllustration,
  FeedStackIllustration,
  FeedAllReadIllustration,
} from './LibraryIllustrations';

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

  // File drag & drop handling
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

      {/* 3D Isometric Multi-Layer Illustration */}
      <IllustrationComponent className="plane-illustration mb-6 shrink-0" />

      {/* Title (h2 ensures valid heading hierarchy after page h1) */}
      <h2 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {config.title}
      </h2>

      {/* Description */}
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

  // Recently Read has its own dedicated component
  if (isRecent && !isSearchActive) {
    return <RecentlyReadEmptyState />;
  }

  // Determine current context variant
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

export default LibraryEmptyState;
