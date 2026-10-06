import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import type { LucideProps } from 'lucide-react';

/**
 * EmptyState
 *
 * Standardised empty-state block. Replaces the ad-hoc inline empty divs
 * scattered across feature pages (LabelsPage, PagesView, DraftsPage, etc.).
 *
 * Design: centre-aligned, dashed border card. Matches the Plane.so / Linear
 * pattern of:
 *   icon  (muted, 32px)
 *   title (text-foreground, font-medium)
 *   body  (text-muted-foreground, text-13)
 *   optional CTA button slot
 *
 * Usage — minimal:
 *   <EmptyState icon={Tag} title="No labels found" />
 *
 * Usage — with body + action:
 *   <EmptyState
 *     icon={FileText}
 *     title="No pages yet"
 *     body="Create a page to start writing in this project."
 *     action={<Button size="sm" onClick={…}>Create page</Button>}
 *   />
 *
 * Usage — inline (no border card, just centred content):
 *   <EmptyState icon={Search} title="No results" inline />
 */

type IconComponent = React.ComponentType<LucideProps>;

export interface EmptyStateProps {
  /** Lucide icon shown above the title */
  icon?: IconComponent;
  /** Custom illustration to render instead of an icon */
  illustration?: React.ReactNode;
  title: string;
  body?: string;
  /** Optional CTA rendered below the body */
  action?: React.ReactNode;
  className?: string;
  /**
   * inline: no dashed border card — just centred text.
   * Use inside a list that already has a container.
   */
  inline?: boolean;
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  body,
  action,
  className,
  inline = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        inline
          ? 'p-8'
          : 'rounded-md border border-dashed border-border bg-card p-12',
        className,
      )}
    >
      {/* Illustration or icon */}
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : Icon ? (
        <div className="mb-3 flex items-center justify-center size-10 rounded-md bg-muted">
          <Icon
            className="size-5 text-muted-foreground shrink-0"
            strokeWidth={1.5}
          />
        </div>
      ) : null}

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h3>

      {/* Body */}
      {body && (
        <p className="mt-1.5 text-12 text-muted-foreground max-w-sm leading-relaxed">
          {body}
        </p>
      )}

      {/* CTA slot */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
