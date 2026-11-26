'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  YourWorkSummaryIllustration,
  YourWorkAssignedIllustration,
  YourWorkCreatedIllustration,
  YourWorkSubscribedIllustration,
  YourWorkActivityIllustration,
  YourWorkSearchIllustration,
} from './Illustrations';

export type EmptyVariant =
  | 'summary'
  | 'assigned'
  | 'created'
  | 'subscribed'
  | 'activity'
  | 'search'
  | 'default';

export interface EmptyStateProps {
  variant?: EmptyVariant;
  searchQuery?: string;
  onClearSearch?: () => void;
  title?: string;
  description?: string;
  className?: string;
  actionText?: string;
  onAction?: () => void;
}

interface EmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const EMPTY_CONFIGS: Record<EmptyVariant, EmptyConfig> = {
  summary: {
    illustration: YourWorkSummaryIllustration,
    title: 'No work items yet',
    description:
      'Your workspace does not have any active workloads, issues, or tasks associated with your account yet.',
  },
  assigned: {
    illustration: YourWorkAssignedIllustration,
    title: 'No work items assigned to you',
    description:
      'You are all caught up! Work items assigned to you by teammates or yourself will be listed here.',
  },
  created: {
    illustration: YourWorkCreatedIllustration,
    title: 'No work items created by you',
    description:
      'Issues, tasks, and work items you create across any active project will appear here for quick access.',
  },
  subscribed: {
    illustration: YourWorkSubscribedIllustration,
    title: 'No subscribed work items',
    description:
      'Work items you comment on or subscribe to will appear here so you can easily track conversations.',
  },
  activity: {
    illustration: YourWorkActivityIllustration,
    title: 'No recent activity',
    description:
      'Recent project updates, status changes, and mentions will show up here as collaboration occurs.',
  },
  search: {
    illustration: YourWorkSearchIllustration,
    title: 'No matching work items',
    description: 'No work items matched your filter query. Try refining your search terms.',
  },
  default: {
    illustration: YourWorkSummaryIllustration,
    title: 'No work items found',
    description: 'There are no work items available in this view.',
  },
};

/**
 * EmptyState
 * Pure Flat Precision empty state for Your Work views.
 * Adheres strictly to Plane.so / Flux standards with 3D isometric SVG illustrations.
 */
export function EmptyState({
  variant = 'default',
  searchQuery,
  onClearSearch,
  title,
  description,
  className,
  actionText,
  onAction,
}: EmptyStateProps) {
  const isSearch = Boolean(searchQuery && searchQuery.trim()) || variant === 'search';
  const effectiveVariant: EmptyVariant = isSearch ? 'search' : variant;
  const config = EMPTY_CONFIGS[effectiveVariant] || EMPTY_CONFIGS.default;

  const displayTitle = title || config.title;
  const displayDescription = description || (
    isSearch && searchQuery
      ? `No work items match "${searchQuery}". Try refining your search terms.`
      : config.description
  );
  const IllustrationComponent = config.illustration;

  const actionNode =
    isSearch && onClearSearch ? (
      <Button
        variant="outline"
        size="sm"
        onClick={onClearSearch}
        className="h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
      >
        Clear filter
      </Button>
    ) : !isSearch && actionText && onAction ? (
      <Button
        size="sm"
        onClick={onAction}
        className="h-7 px-3 text-12 font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
      >
        {actionText}
      </Button>
    ) : undefined;

  return (
    <PlaneEmptyState
      title={displayTitle}
      description={displayDescription}
      illustration={
        <div className="plane-your-work-illustration flex items-center justify-center">
          <IllustrationComponent />
        </div>
      }
      action={actionNode}
      className={cn('bg-background', className)}
    />
  );
}

export default EmptyState;
