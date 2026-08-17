// ── Pages ──────────────────────────────────────────────────────────────────
export { default as LibraryPage } from './pages/LibraryPage';
export { default as FavoritesPage } from './pages/FavoritesPage';
export { default as RecentlyReadPage } from './pages/RecentlyReadPage';
export { default as UnfiledPage } from './pages/UnfiledPage';
export { default as DuplicatesPage } from './pages/DuplicatesPage';
export { default as TrashPage } from './pages/TrashPage';
export { default as ReaderPage } from './pages/ReaderPage';
export { default as CollectionPage } from './pages/CollectionPage';

// ── Components ─────────────────────────────────────────────────────────────
export { default as Sidebar } from './components/library/layout/sidebar';
export { default as Topbar } from './components/library/layout/topbar';
export { default as PaperTable } from './components/library/table/paper-table';
export { default as InspectorPanel } from './components/library/inspector/inspector-panel';
export { default as UploadModal } from './components/library/modals/upload-modal';
export { default as CreateCollectionModal } from './components/library/modals/create-collection-modal';

// ── Services ───────────────────────────────────────────────────────────────
export {
  PaperService,
  paperKeys,
  getAllPapers,
  getPaperById,
  getCollectionPapers,
  createPaper,
  updatePaper,
  deletePaper,
  ingestPaper,
  addPaperAttachment,
  deletePaperAttachment,
  importPaperFromStorage,
  reindexPaper,
  fetchPdfBlob,
} from './services/paper.service';

export {
  CollectionService,
  collectionKeys,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  invalidateCollections,
} from './services/collection.service';

export {
  ReferenceService,
  fetchReferenceByDoi,
  searchReferences,
} from './services/reference.service';

// ── Stores ─────────────────────────────────────────────────────────────────
export { useLibrarySidebarStore } from './store/sidebar.store';
export { useLibraryReaderStore } from './store/reader.store';

// ── Data Hooks ─────────────────────────────────────────────────────────────
export { useCollections } from './hooks/data/use-collections';
export { usePapers, usePaper as usePaperData } from './hooks/data/use-papers';
export { useReferences } from './hooks/data/use-references';

// ── Feature Hooks ──────────────────────────────────────────────────────────
export { useLibrary } from './hooks/library/use-library';
export { useCollection } from './hooks/library/use-collection';
export { usePaper } from './hooks/library/use-paper';
export { useReader } from './hooks/reader/use-reader';
export { usePdf } from './hooks/reader/use-pdf';
export { useChat } from './hooks/reader/use-chat';

// ── Utilities ──────────────────────────────────────────────────────────────
export * from './utils/library.util';
export * from './utils/filter';
export * from './utils/bibtex';
export * from './utils/metadata';

// ── Types ──────────────────────────────────────────────────────────────────
export type * from './types/library.types';
export type * from './types/reader.types';
export type * from './types/reference.types';
export type * from './types/ai.types';

// ── Schemas ────────────────────────────────────────────────────────────────
export * from './schemas/library.schema';
export * from './schemas/reader.schema';
