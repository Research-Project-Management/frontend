'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  pagesIllustrationStyles,
  PagesStackIllustration,
  PagesSearchStackIllustration,
  PagesLabelStackIllustration,
  PagesStarredStackIllustration,
  PagesArchivedStackIllustration,
} from './PagesIllustrations';

export interface PagesEmptyStateProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  labelName?: string;
  onClearFilter?: () => void;
  variant?: 'default' | 'search' | 'label' | 'favorite' | 'archive';
  onCreateClick?: () => void;
  className?: string;
}

type PagesEmptyVariant = 'default' | 'search' | 'label' | 'favorite' | 'archive';

interface PagesEmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

/**
 * PagesEmptyState
 * Pure Flat Precision / Plane.so standard empty state for Pages and Documents.
 * Perfectly aligned with Library and Storage:
 * - 3D Isometric multi-layer illustrations with dynamic lighting tokens
 * - Seamless default background (no heavy borders or jarring action buttons)
 * - Restrained typography: text-16 semibold title, text-13 muted description
 * - Context-aware variants for search, labels, favorites, archives, and default
 */
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

  // Determine current pages context variant
  const variant: PagesEmptyVariant = (() => {
    if (isSearchActive) return 'search';
    if (labelName || propVariant === 'label') return 'label';
    if (propVariant === 'favorite' || pathname?.includes('/favorite') || pathname?.includes('/starred')) return 'favorite';
    if (propVariant === 'archive' || pathname?.includes('/archive') || pathname?.includes('/trash')) return 'archive';
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
            ? `No pages or documents found matching "${searchQuery}". Try checking for spelling errors or searching with broader keywords.`
            : 'No pages match the search criteria. Try adjusting your query.',
        };
      case 'label':
        return {
          illustration: PagesLabelStackIllustration,
          title: 'No labeled pages',
          description: labelName
            ? `No pages are currently assigned the "${labelName}" label. Try selecting another label or clearing the filter.`
            : 'No pages match the selected label filter.',
        };
      case 'favorite':
        return {
          illustration: PagesStarredStackIllustration,
          title: 'No favorite pages',
          description: 'Star important wiki documents and project notes to keep them within quick reach.',
        };
      case 'archive':
        return {
          illustration: PagesArchivedStackIllustration,
          title: 'No archived pages',
          description: 'Archived project documentation and outdated notes will appear here.',
        };
      case 'default':
      default:
        return {
          illustration: PagesStackIllustration,
          title: 'No pages yet',
          description: 'Create collaborative wiki documents, research notes, and specs to build your project knowledge base.',
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
      <style dangerouslySetInnerHTML={{ __html: pagesIllustrationStyles }} />

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
            className="h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer shadow-none"
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
            className="h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer shadow-none"
          >
            Clear label filter
          </Button>
        </div>
      )}
    </div>
  );
}

export default PagesEmptyState;
