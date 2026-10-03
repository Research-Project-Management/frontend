import * as React from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * PageToolbar
 *
 * Secondary bar below PageHeader. Used for search + filter + view-toggle rows.
 * Height: 40px (h-10) — slightly shorter than the header to create visual
 * hierarchy.
 *
 * Design decision: PageToolbar sits INSIDE PageContent's scroll container so
 * it scrolls away on long list pages (consistent with Linear / Plane.so).
 * Pass `sticky` if you want it to remain fixed while content scrolls.
 *
 * Slots:
 *  - `left`   → search input, label filters, etc.
 *  - `right`  → view-mode toggle, sort, grouping controls
 *  - `children` → full-width override (bypasses left/right split)
 *
 * Usage:
 *   <PageToolbar
 *     left={<SearchInput … />}
 *     right={<ViewToggle … />}
 *   />
 */

export interface PageToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Make the toolbar stick while page content scrolls */
  sticky?: boolean;
}

export function PageToolbar({
  left,
  right,
  children,
  className,
  sticky = false,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        // Layout
        'flex items-center justify-between gap-4',
        // Height & padding — 40px toolbar
        'min-h-10 shrink-0',
        sticky && 'sticky top-11 z-[9] bg-background',
        className,
      )}
    >
      {children ? (
        children
      ) : (
        <>
          {left  && <div className="flex items-center gap-2 flex-1 min-w-0">{left}</div>}
          {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
        </>
      )}
    </div>
  );
}
