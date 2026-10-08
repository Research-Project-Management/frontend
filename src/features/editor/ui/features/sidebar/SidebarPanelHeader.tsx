'use client';

/**
 * SidebarPanelHeader.tsx
 *
 * Canonical Viewlet Header for Primary Sidebar (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/SidebarPanelHeader.tsx`
 */

import React from 'react';
import { X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface SidebarPanelHeaderProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  closeAriaLabel?: string;
}

export function SidebarPanelHeader({
  title,
  children,
  onClose,
  className,
  closeAriaLabel = 'Close panel',
}: SidebarPanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between border-b border-border px-3 bg-surface select-none',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        {typeof title === 'string' ? (
          <span className="font-semibold text-13 text-foreground tracking-tight truncate">
            {title}
          </span>
        ) : (
          title
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {children}

        {onClose && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeAriaLabel}
                className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary motion-reduce:transition-none"
              >
                <X className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Close
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default SidebarPanelHeader;
