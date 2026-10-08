'use client';

import { History } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { OverleafResolvedCommentsIcon } from './OverleafReviewIcon';
import { SidebarPanelHeader } from '../../SidebarPanelHeader';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

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
      {/* Version History Trigger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => editorCommandBus.dispatch({ type: 'history:open-modal' })}
            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Open Version History"
          >
            <History className="size-4 shrink-0 text-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Version History & Revisions</TooltipContent>
      </Tooltip>

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
        <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </SidebarPanelHeader>
  );
}

export default ReviewHeader;
