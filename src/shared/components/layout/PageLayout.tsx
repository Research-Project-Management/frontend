import * as React from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * PageLayout
 *
 * Root shell for every feature page. Fills the entire parent container
 * (h-full), stacks header + content vertically, and applies the canonical
 * app background.
 *
 * Usage:
 *   <PageLayout>
 *     <PageHeader title="Labels" icon={Tag} />
 *     <PageContent>…</PageContent>
 *   </PageLayout>
 */
export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col bg-background select-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── PageContent ─────────────────────────────────────────────────────────────
/**
 * PageContent
 *
 * The scrollable body beneath PageHeader. Provides uniform horizontal padding
 * and a centred max-width container so every settings / list page looks
 * consistent without each page hard-coding its own padding.
 *
 * Props:
 *  - maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full'  (default 'lg')
 *  - noPadding: bypass built-in padding (for full-bleed views like Kanban)
 */
export interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  noPadding?: boolean;
}

const maxWidthClasses: Record<NonNullable<PageContentProps['maxWidth']>, string> = {
  sm:   'max-w-xl',
  md:   'max-w-3xl',
  lg:   'max-w-5xl',
  xl:   'max-w-7xl',
  full: 'max-w-none',
};

export function PageContent({
  children,
  className,
  maxWidth = 'lg',
  noPadding = false,
}: PageContentProps) {
  return (
    <main
      className={cn(
        'flex-1 min-h-0 overflow-y-auto',
        !noPadding && 'p-6 md:p-8',
        className,
      )}
    >
      {maxWidth === 'full' ? (
        children
      ) : (
        <div className={cn('w-full mx-auto', maxWidthClasses[maxWidth])}>
          {children}
        </div>
      )}
    </main>
  );
}
