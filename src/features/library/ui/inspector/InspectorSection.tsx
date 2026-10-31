'use client';

import React from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { type InspectorSectionId } from '@/features/library/core/store/library-ui.store';
import { cn } from '@/shared/lib/utils';

export interface InspectorSectionProps {
  id: InspectorSectionId;
  title: string;
  count?: number;
  isExpanded: boolean;
  isHighlighted?: boolean;
  onToggleExpand: () => void;
  onAdd?: () => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  canEdit?: boolean;
  keepMounted?: boolean;
}

export function InspectorSection({
  id,
  title,
  count,
  isExpanded,
  isHighlighted = false,
  onToggleExpand,
  onAdd,
  actionSlot,
  children,
  contentClassName = 'px-2.5 pt-1.5 pb-2.5',
  canEdit = true,
  keepMounted = false,
}: InspectorSectionProps) {
  return (
    <div
      id={`inspector-section-${id}`}
      className={cn(
        'group/section border-b border-border last:border-b-0 w-full transition-colors duration-300',
        isHighlighted && 'bg-muted/60',
      )}
    >
      {/* Section Header Bar: Standard h-8 height to synchronize with Table Rows */}
      <div
        onClick={onToggleExpand}
        className={cn(
          'flex items-center justify-between px-2.5 h-8 box-border select-none transition-colors w-full cursor-pointer hover:bg-muted/50',
          isHighlighted && 'bg-muted/80',
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={isExpanded}
          aria-controls={`section-content-${id}`}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs py-0.5 cursor-pointer"
        >
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono font-medium text-foreground px-1.5 py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </button>

        {/* Right Corner Action Cluster: [ actionSlot ] [ + ] [ > / v ] */}
        <div role="presentation" className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionSlot}
          {onAdd && canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                  aria-label={`Add ${title.toLowerCase()}`}
                >
                  <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {`Add ${title.toLowerCase()}`}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {isExpanded ? 'Collapse section' : 'Expand section'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Section Content (collapsible) */}
      {(isExpanded || keepMounted) && (
        <div
          id={`section-content-${id}`}
          className={cn('bg-background', isExpanded ? contentClassName : 'hidden')}
        >
          {children}
        </div>
      )}
    </div>
  );
}
export default InspectorSection;
