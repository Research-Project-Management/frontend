/**
 * library.client.ts
 *
 * UNIFIED LIBRARY CLIENT SDK FACADE
 * Composes domain-aligned client modules:
 * - ./clients/http.client.ts (Transport, URL resolution, PDF Blob LRU cache)
 * - ./clients/items.client.ts (ItemsService, RelationsService)
 * - ./clients/catalog-entities.client.ts (Collections, Tags, Notes, State, SavedSearches)
 * - ./clients/citation-extraction.client.ts (Citation, Exports, Attachments, Upload, Reader)
 * - ./clients/ingestion-sync.client.ts (Ingestion, Curation, Retraction, Search, Sync, Feeds)
 */

export {
  isProjectScope,
  getItemFileUrl,
  mapBackendItem,
  type TagWithCount,
  type ItemStateData,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
  type ReferenceData,
  type CslStyleMetadata,
  type LibrarySubdomain,
  getLibraryServiceHost,
  resolveLibraryUrl,
  resolveLibraryRawPath,
  libraryClient,
  sanitizeItemPayload,
  fetchPdfBlob,
} from './clients/http.client';

export {
  type ItemMetadataSourceItem,
  type ItemMetadataSourcesResponse,
  type ItemTypesResponse,
  type LibraryBootstrapResponse,
  ItemsService,
  RelationsService,
} from './clients/items.client';

export {
  type CreateNoteDTO,
  type UpdateNoteDTO,
  type ExtractNotesOptions,
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
} from './clients/catalog-entities.client';

export {
  CitationService,
  ExportsService,
  AttachmentsService,
  UploadService,
  ExtractionTelemetryService,
  AnnotationsService,
} from './clients/citation-extraction.client';

export {
  type FeedSubscriptionResponse,
  IngestionService,
  CurationService,
  RetractionService,
  SearchService,
  SyncService,
  FeedsService,
} from './clients/ingestion-sync.client';

import { ItemsService, RelationsService } from './clients/items.client';
import {
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
} from './clients/catalog-entities.client';
import {
  CitationService,
  ExportsService,
  AttachmentsService,
  UploadService,
  ExtractionTelemetryService,
  AnnotationsService,
} from './clients/citation-extraction.client';
import {
  IngestionService,
  CurationService,
  RetractionService,
  SearchService,
  SyncService,
  FeedsService,
} from './clients/ingestion-sync.client';

export const libraryServices = {
  items: ItemsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  state: StateService,
  savedSearches: SavedSearchesService,
  relations: RelationsService,
  citations: CitationService,
  exports: ExportsService,
  attachments: AttachmentsService,
  upload: UploadService,
  telemetry: ExtractionTelemetryService,
  annotations: AnnotationsService,
  ingestion: IngestionService,
  curation: CurationService,
  retraction: RetractionService,
  search: SearchService,
  sync: SyncService,
  feeds: FeedsService,
};

export default libraryServices;
