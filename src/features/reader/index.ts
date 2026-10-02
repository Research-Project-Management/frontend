/**
 * Public API Surface for features/reader
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Pages
export { default as ReaderPage } from './pages/ReaderPage';

// Hooks
export * from './hooks/use-reader';
export * from './hooks/use-pdf';
export * from './hooks/use-reader-feedback';
export { useAnnotations } from './hooks/use-annotations';

// Store
export { useReaderStore } from './store/reader.store';
export {
  useReaderSidebarStore,
  useReaderViewStore,
  useReaderModalStore,
  useReaderUIStore,
} from './store/reader-ui.store';

// Data SDK & Queries
export * from './data';

// Components
export * from './components/inspector';
export { default as Panel, default as InspectorPanel } from './components/Panel';

// Types
export type * from './types/reader.types';

