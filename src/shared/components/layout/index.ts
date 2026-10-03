/**
 * Shared Layout Blocks
 *
 * These are the macro-layout primitives every feature page should use.
 * Using these ensures that one token change in globals.css propagates
 * everywhere — no freestyle layout code in feature pages.
 *
 * Import from here:
 *   import { PageLayout, PageContent, PageHeader, PageToolbar, EmptyState, SectionLabel } from '@/shared/components/layout';
 */

export { PageLayout, PageContent } from './PageLayout';
export type { PageLayoutProps, PageContentProps } from './PageLayout';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { PageToolbar } from './PageToolbar';
export type { PageToolbarProps } from './PageToolbar';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { SectionLabel } from './SectionLabel';
export type { SectionLabelProps } from './SectionLabel';
