import * as React from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * SectionLabel
 *
 * A section divider with a text label — the canonical pattern for grouping
 * content within a scrollable list (sidebar sections, settings groups, etc.).
 *
 * Matches Plane.so / Linear design:
 *   ─────  SECTION TITLE  ────────────────
 *
 * Variants:
 *  - 'line'   (default) → subtle underline below the label
 *  - 'inline' → full-width rule with label floating in the middle
 *  - 'plain'  → label only, no decorative lines
 *
 * Usage:
 *   <SectionLabel>Workspace</SectionLabel>
 *   <SectionLabel variant="inline">Members</SectionLabel>
 *   <SectionLabel count={3}>Open Issues</SectionLabel>
 */

export interface SectionLabelProps {
  children: React.ReactNode;
  /** Optional count badge shown after the label */
  count?: number;
  variant?: 'line' | 'inline' | 'plain';
  className?: string;
}

export function SectionLabel({
  children,
  count,
  variant = 'line',
  className,
}: SectionLabelProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 select-none',
          className,
        )}
      >
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="flex items-center gap-1.5 text-11 font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          {children}
          {count !== undefined && (
            <span className="text-11 font-medium tabular-nums">{count}</span>
          )}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
    );
  }

  if (variant === 'plain') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 select-none',
          className,
        )}
      >
        <span className="text-11 font-medium uppercase tracking-wider text-muted-foreground">
          {children}
        </span>
        {count !== undefined && (
          <span className="text-11 font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </div>
    );
  }

  // Default: 'line'
  return (
    <div
      className={cn(
        'flex items-center gap-2 pb-1.5 border-b border-border select-none',
        className,
      )}
    >
      <span className="text-11 font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {children}
      </span>
      {count !== undefined && (
        <span className="text-11 font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}
