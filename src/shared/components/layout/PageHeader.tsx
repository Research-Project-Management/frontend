import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import type { LucideProps } from 'lucide-react';

/**
 * PageHeader
 *
 * Sticky top bar used by every feature page. Matches the 44px (h-11) height
 * established by the settings TopBar. Composes:
 *  - Left: icon + title (+ optional breadcrumb / description)
 *  - Right: `actions` slot for buttons, filters, view-toggle, etc.
 *
 * Design tokens used (zero hardcoded colours):
 *  - bg-transparent (inherits page background — sticky on scroll shows bg)
 *  - border-b border-border
 *  - text-foreground for title & icon
 *  - text-muted-foreground for description
 *
 * Usage:
 *   <PageHeader
 *     title="Labels"
 *     description="Manage workspace labels."
 *     icon={Tag}
 *     actions={<Button size="sm">Add label</Button>}
 *   />
 */

type IconComponent = React.ComponentType<LucideProps>;

export interface PageHeaderProps {
  title: string;
  icon?: IconComponent;
  actions?: React.ReactNode;
  className?: string;
  /** Optional breadcrumb node rendered left of the title */
  breadcrumb?: React.ReactNode;
  /** Optional badge rendered immediately right of the title */
  badge?: React.ReactNode;
}

export function PageHeader({
  title,
  icon: Icon,
  actions,
  className,
  breadcrumb,
  badge,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        // Layout
        'flex items-center justify-between gap-3',
        // Sizing — 44px height matches settings TopBar
        'h-11 px-4 shrink-0',
        // Stacking context
        'sticky top-0 z-10 select-none overflow-x-auto scrollbar-none min-w-0',
        // Solid background prevents content bleeding through on scroll
        'bg-background border-b border-border',
        className,
      )}
    >
      {/* ── Left: icon + title + optional breadcrumb ── */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        {breadcrumb && (
          <div className="flex items-center text-muted-foreground shrink-0">
            {breadcrumb}
          </div>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <Icon
              className="size-4 text-foreground shrink-0"
              strokeWidth={1.75}
            />
          )}

          <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>

          {badge && (
            <div className="flex items-center shrink-0">
              {badge}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: action slot ── */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
