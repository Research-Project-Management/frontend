'use client';

/**
 * Features / Library - Canonical Hooks
 * Centralized export for all custom hooks in the Library feature.
 */

export * from './use-pdf';
export * from './use-quick-copy';
export * from './useLibraryBatchCoordinator';
export * from './useLibraryNavigation';

// Co-located component hooks re-exported for ergonomic access from the hooks layer
export { useInspectorResize } from '../components/inspector/useInspectorResize';
export { useSidebarResize } from '../components/sidebar/useSidebarResize';
export { useCollectionActions } from '../components/sidebar/useCollectionActions';

