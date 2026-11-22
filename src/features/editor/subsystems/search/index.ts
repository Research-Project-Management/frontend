/**
 * src/features/editor/subsystems/search/index.ts
 *
 * Search Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Full-project regular expression, case-sensitive, and whole-word text search.
 * - Global project and single-file replace actions.
 * - Search Sidebar Tab viewlet.
 */

export { default as SearchTab, default } from './ui/SearchTab';
export { useProjectSearchActions } from './ui/useProjectSearchActions';
