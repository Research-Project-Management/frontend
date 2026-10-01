/**
 * Public API Surface for features/reader
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Pages
export { default as ReaderPage } from './pages/ReaderPage';

// Hooks
export * from './hooks/use-reader';
export * from './hooks/use-annotations';
export * from './hooks/use-notes';
export * from './hooks/use-pdf';
export * from './hooks/use-reader-feedback';

// Store
export { useReaderStore } from './store/reader.store';
export * from './store/reader-ui.store';

// Data SDK & Queries
export * from './data';

// Components
export * from './components/inspector';
export { default as Panel, InspectorPanel } from './components/Panel';

// Types
export type * from './types/reader.types';

