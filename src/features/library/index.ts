/**
 * Features / Library - Public API
 *
 * This is the ONLY entry point that external features (reader, projects, etc.)
 * and app routes are permitted to import from.
 */

// Pages (for Next.js App Router)
export {
  ModernLibraryPage as LibraryPage,
  ModernLibraryPage,
  TrashPage,
  DuplicatesPage,
  RecentlyReadPage,
  UnfiledPage,
} from './pages';
export { LibrarySidebar as Sidebar, LibrarySidebar } from './components';
export { LibraryTopbar as Topbar, LibraryTopbar } from './components';

// Types
export * from './types';

// Architecture Layers: Store, Data, Domain, Components, Utils
export * from './store';
export * from './data';
export * from './domain';
export * from './components';
export * from './utils';

// Data Access Layer (Queries, Services, Centralized Query Keys)
export {
  // Queries
  useItems,
  useViewItems,
  useCollections,
  useAttachments,
  useAttachmentRevisions,
  useRenameAttachment,
  useNotes,
  useRelations,
  useDuplicateGroups,
  useRetraction,
  useSavedSearches,
  useConversion,
  useItemTypeConversion,
  // Services
  ItemService,
  ItemsService,
  CollectionService,
  ExportService,
  downloadAnnotatedPdf,
  uploadLibraryFile,
  fetchPdfBlob,
} from './data';

// Schemas & Types
export { ALL_ITEM_TYPES_FLAT } from './types';

// Utilities & Domain
export {
  normalizeNotes,
  normalizeTags,
  getPaperFileUrl,
  getPaperCitationKey,
  cleanDoi,
} from './domain';

// Modals (exported for Reader integration and external features)
export { default as CreateCollectionModal } from './components/modals/CreateCollectionModal';
export { default as DeleteModal, type DeleteModalConfig } from './components/modals/DeleteModal';

