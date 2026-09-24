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
} from './LibraryIllustrations';

export interface LibraryEmptyStateProps {
  search?: string;
  activeFilter?: string | null;
  collectionId?: string;
  collectionName?: string;
  canEdit?: boolean;
  onClearSearch?: () => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
  onAddCollection?: () => void;
}

type EmptyStateVariant =
  | 'recent'
  | 'search'
  | 'trash'
  | 'starred'
  | 'retracted'
  | 'unfiled'
  | 'publications'
  | 'saved-search'
  | 'collection'
  | 'default';

interface EmptyStateConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  showDropzone: boolean;
}

export function LibraryEmptyState({
  search = '',
  activeFilter = null,
  collectionId,
  collectionName,
  canEdit = true,
  onClearSearch,
  onDirectFilesUpload,
  onAddLink,
}: LibraryEmptyStateProps) {
  const pathname = usePathname();
  const [isDragOver, setIsDragOver] = useState(false);

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
    if (isRecent) return 'recent';
    if (activeFilter === 'trash' || activeFilter === 'bin') return 'trash';
    if (activeFilter === 'starred' || activeFilter === 'favorites') return 'starred';
    if (activeFilter === 'retracted') return 'retracted';
    if (activeFilter === 'unfiled') return 'unfiled';
    if (activeFilter === 'my-publications' || activeFilter === 'publications') return 'publications';
    if (activeFilter === 'saved-search') return 'saved-search';
    if (collectionId) return 'collection';
    return 'default';
  })();

  const getConfig = (): EmptyStateConfig => {
    switch (variant) {
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
      case 'publications':
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
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background transition-colors',
        config.showDropzone && canEdit && isDragOver && 'border-2 border-dashed border-primary bg-primary/5 ring-1 ring-primary',
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: libraryIllustrationStyles }} />

      {/* 3D Isometric Multi-Layer Illustration */}
      <div className="plane-library-illustration mb-6 flex items-center justify-center">
        <IllustrationComponent />
      </div>

      {/* Title */}
      <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {config.title}
      </h3>

      {/* Description */}
      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
        {config.description}
      </p>
    </div>
  );
}

export default LibraryEmptyState;
