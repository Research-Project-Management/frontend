'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { OverleafResolvedCommentsIcon } from './OverleafReviewIcon';
import { SidebarPanelHeader } from '../../common/SidebarPanelHeader';

interface ReviewHeaderProps {
  showResolved: boolean;
  onToggleResolved: () => void;
  activeResolvedCount: number;
  onClose?: () => void;
}

export function ReviewHeader({
  showResolved,
  onToggleResolved,
  activeResolvedCount,
  onClose,
}: ReviewHeaderProps) {
  const handleToggle = () => {
    if (activeResolvedCount === 0) return;
    onToggleResolved();
  };

  const tooltipLabel =
    activeResolvedCount === 0
      ? 'No resolved comments'
      : showResolved
        ? 'Hide resolved comments'
        : `Resolved comments: ${activeResolvedCount}`;

  return (
    <SidebarPanelHeader
      title="Review"
      onClose={onClose}
      closeAriaLabel="Close review panel"
    >
      {/* Resolved comments toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              showResolved
                ? 'bg-muted text-foreground'
                : 'text-foreground hover:bg-muted',
            )}
            aria-label={tooltipLabel}
          >
            <OverleafResolvedCommentsIcon className="size-4 shrink-0 text-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-11">
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
    </SidebarPanelHeader>
  );
}

export default ReviewHeader;
