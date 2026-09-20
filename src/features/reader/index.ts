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

// Store
export { useReaderStore } from './store/reader.store';

// Types
export type * from './types/reader.types';
