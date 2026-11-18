export * from './clients/http.client';
export * from './clients/items.client';
export * from './clients/catalog-entities.client';
export * from './clients/curation.client';
export * from './clients/attachments-annotations.client';
export * from './query-keys';

import { ItemsService, RelationsService } from './clients/items.client';
import {
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
  SearchService,
  SyncService,
} from './clients/catalog-entities.client';
import {
  CurationService,
  RetractionService,
  IngestionService,
  FeedsService,
} from './clients/curation.client';
import {
  AttachmentsService,
  UploadService,
  AnnotationsService,
  CitationService,
  ExportsService,
} from './clients/attachments-annotations.client';

export const libraryServices = {
  items: ItemsService,
  relations: RelationsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  state: StateService,
  savedSearches: SavedSearchesService,
  search: SearchService,
  sync: SyncService,
  curation: CurationService,
  retraction: RetractionService,
  ingestion: IngestionService,
  feeds: FeedsService,
  attachments: AttachmentsService,
  upload: UploadService,
  annotations: AnnotationsService,
  citations: CitationService,
  exports: ExportsService,
};
