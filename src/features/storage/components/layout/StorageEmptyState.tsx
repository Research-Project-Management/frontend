'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import {
  storageIllustrationStyles,
  StorageFilesStackIllustration,
  StorageSharedStackIllustration,
  StorageStarredStackIllustration,
  StorageTrashStackIllustration,
  StorageSearchStackIllustration,
} from './StorageIllustrations';

export interface StorageEmptyStateProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  isReadOnly?: boolean;
  isTrash?: boolean;
  className?: string;
}

type StorageEmptyVariant =
  | 'search'
  | 'trash'
  | 'starred'
  | 'shared'
  | 'my-files'
  | 'default';

interface StorageEmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

/**
 * StorageEmptyState
 * Pure Flat Precision / Plane.so standard empty state for Cloud Storage.
 * Strictly contains NO action buttons, seamless default background, and
 * tailored 3D isometric illustrations for each storage view.
 */
export function StorageEmptyState({
  searchQuery = '',
  isTrash = false,
  className,
}: StorageEmptyStateProps) {
  const pathname = usePathname();
  const isSearchActive = Boolean(searchQuery.trim());

  // Determine storage view context variant
  const variant: StorageEmptyVariant = (() => {
    if (isSearchActive) return 'search';
    if (isTrash || pathname?.includes('/trash')) return 'trash';
    if (pathname?.includes('/starred')) return 'starred';
    if (pathname?.includes('/shared')) return 'shared';
    if (pathname?.includes('/my-files')) return 'my-files';
    return 'default';
  })();

  const getConfig = (): StorageEmptyConfig => {
    switch (variant) {
      case 'search':
        return {
          illustration: StorageSearchStackIllustration,
          title: 'No matching files',
          description: `No files or folders found matching "${searchQuery}". Try checking for spelling errors or searching with broader keywords.`,
        };
      case 'trash':
        return {
          illustration: StorageTrashStackIllustration,
          title: 'Trash is empty',
          description: 'Deleted files and folders will appear here until permanently cleared.',
        };
      case 'starred':
        return {
          illustration: StorageStarredStackIllustration,
          title: 'No starred files',
          description: 'Star important files and folders to keep them easily accessible in your favorites.',
        };
      case 'shared':
        return {
          illustration: StorageSharedStackIllustration,
          title: 'No shared files',
          description: 'Files and folders shared with you by team members and collaborators will appear here.',
        };
      case 'my-files':
        return {
          illustration: StorageFilesStackIllustration,
          title: 'No files uploaded',
          description: 'Upload documents, datasets, or media files to start organizing your cloud storage workspace.',
        };
      case 'default':
      default:
        return {
          illustration: StorageFilesStackIllustration,
          title: 'No files yet',
          description: 'Files and folders you upload or access will appear here for quick navigation.',
        };
    }
  };

  const config = getConfig();
  const IllustrationComponent = config.illustration;

  return (
    <div
      className={cn(
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background',
        className
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: storageIllustrationStyles }} />

      {/* 3D Isometric Multi-Layer Storage Illustration */}
      <div className="plane-storage-illustration mb-6 flex items-center justify-center">
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

export default StorageEmptyState;
