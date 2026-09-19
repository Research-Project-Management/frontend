/**
 * Features / Library - Public API
 *
 * This is the ONLY entry point that external features (reader, projects, etc.)
 * and app routes are permitted to import from.
 */

// Pages (for Next.js App Router)
export { ModernLibraryPage as LibraryPage, ModernLibraryPage } from './ui';
export { default as TrashPage } from './pages/TrashPage';
export { default as DuplicatesPage } from './pages/DuplicatesPage';
export { default as RecentlyReadPage } from './pages/RecentlyReadPage';
export { default as UnfiledPage } from './pages/UnfiledPage';
export { default as Sidebar } from './components/Sidebar';

// Types
export * from './types';

// New Architecture: Store, Data, Domain, UI
export * from './store';
export * from './data';
export * from './domain';
export * from './ui';

// Store (Workspace & Layout State)
export { useLibrarySidebarStore, type InspectorSectionId } from './store/sidebar.store';

// Hooks (Data & Domain)
export { useItems, useViewItems } from './hooks/use-items';
export { useCollections } from './hooks/use-collections';
export { useAttachments, useAttachmentRevisions, useRenameAttachment } from './hooks/use-attachments';
export { useNotes } from './hooks/use-notes';
export { useRelations } from './hooks/use-relations';
export { useDuplicateGroups } from './hooks/use-curation';
export { useRetraction } from './hooks/use-retraction';
export { useSavedSearches } from './hooks/use-saved-searches';

// Services
export { ItemService, ItemsService, fetchPdfBlob } from './services/items.service';
export { CollectionService } from './services/collections.service';
export { ExportService, downloadAnnotatedPdf } from './services/exports.service';
export { uploadLibraryFile } from './services/upload.service';

// Schemas
export { ALL_ITEM_TYPES_FLAT } from './schemas/item-type.schema';

// Utilities
export {
  normalizeNotes,
  normalizeTags,
  getPaperFileUrl,
  getPaperCitationKey,
  cleanDoi,
} from './utils/library.util';

// Panel sections (exported for Reader integration)
export { default as InfoSection } from './components/panel/InfoSection';
export { default as AbstractSection } from './components/panel/AbstractSection';
export { default as CollectionsSection } from './components/panel/CollectionsSection';
export { default as NotesSection } from './components/panel/NotesSection';
export { default as TagsSection } from './components/panel/TagsSection';
export { default as CiteSection } from './components/panel/CiteSection';
export { default as RelatedSection } from './components/panel/RelatedSection';
export { default as AttachmentsSection } from './components/panel/AttachmentsSection';

// Modals (exported for Reader integration)
export { default as CreateCollectionModal } from './components/modals/CreateCollectionModal';
export { default as DeleteModal, type DeleteModalConfig } from './components/modals/DeleteModal';

