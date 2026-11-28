'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  PagesStackIllustration,
  PagesSearchStackIllustration,
  PagesLabelStackIllustration,
  PagesArchivedStackIllustration,
} from './PagesIllustrations';

export interface PagesEmptyStateProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  labelName?: string;
  onClearFilter?: () => void;
  variant?: 'default' | 'search' | 'label' | 'archive' | 'trash';
  className?: string;
}

type PagesEmptyVariant = 'default' | 'search' | 'label' | 'archive' | 'trash';

interface PagesEmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function PagesEmptyState({
  searchQuery = '',
  onClearSearch,
  labelName,
  onClearFilter,
  variant: propVariant,
  className,
}: PagesEmptyStateProps) {
  const pathname = usePathname();
  const isSearchActive = Boolean(searchQuery.trim());

  const variant: PagesEmptyVariant = (() => {
    if (isSearchActive) return 'search';
    if (labelName || propVariant === 'label') return 'label';
    if (propVariant === 'trash' || pathname?.includes('/trash')) return 'trash';
    if (propVariant === 'archive' || pathname?.includes('/archive')) return 'archive';
    if (propVariant) return propVariant;
    return 'default';
  })();

  const getConfig = (): PagesEmptyConfig => {
    switch (variant) {
      case 'search':
        return {
          illustration: PagesSearchStackIllustration,
          title: 'No matching pages',
          description: searchQuery
            ? `No pages found matching "${searchQuery}". Try adjusting your keywords.`
            : 'No pages match the search criteria.',
        };
      case 'label':
        return {
          illustration: PagesLabelStackIllustration,
          title: 'No labeled pages',
          description: labelName
            ? `No pages are assigned the "${labelName}" label.`
            : 'No pages match the selected label filter.',
        };
      case 'trash':
        return {
          illustration: PagesArchivedStackIllustration,
          title: 'Trash is empty',
          description: 'Deleted pages will appear here so you can restore or permanently remove them.',
        };
      case 'archive':
        return {
          illustration: PagesArchivedStackIllustration,
          title: 'No archived pages',
          description: 'Archived pages will appear here.',
        };
      case 'default':
      default:
        return {
          illustration: PagesStackIllustration,
          title: 'No pages yet',
          description: 'Create your first page to start writing and collaborating.',
        };
    }
  };

  const config = getConfig();
  const IllustrationComponent = config.illustration;

  return (
    <div
      role="region"
      aria-label="Empty pages state"
      className={cn(
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background',
        className,
      )}
    >
      {/* 3D Isometric Multi-Layer Pages Illustration */}
      <div className="plane-pages-illustration mb-6 flex items-center justify-center">
        <IllustrationComponent />
      </div>

      {/* Title (h2 ensures valid heading hierarchy after page h1) */}
      <h2 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
        {config.title}
      </h2>

      {/* Description */}
      <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
        {config.description}
      </p>

      {/* Optional Search / Filter Reset Controls */}
      {variant === 'search' && onClearSearch && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            className="h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Clear search
          </Button>
        </div>
      )}

      {variant === 'label' && onClearFilter && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilter}
            className="h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Clear label filter
          </Button>
        </div>
      )}
    </div>
  );
}

export default PagesEmptyState;
