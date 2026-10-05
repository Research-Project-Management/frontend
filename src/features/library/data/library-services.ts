/**
 * library-services.ts
 *
 * CANONICAL UNIFIED LIBRARY CLIENT SDK
 *
 * Microservice-ready client SDK for the Library subsystem.
 * Exposes the Library domain organized into 6 Bounded Contexts:
 *  - catalog: Items, Collections, Tags, Notes, Reading State, CSL Item Types, Saved Searches, Relations
 *  - extraction: Attachments, Annotations, Upload S3/Multipart
 *  - ingestion: Ingestion pipeline, Curation (Duplicates/Merge), Retraction Watch
 *  - citation: CSL 10k styles format, Exports (BibTeX, RIS, Annotated PDF)
 *  - search: Postgres FTS search, PDF text anchors
 *  - sync: Multi-tenant CDC change log, tombstones, monotonic sequence
 *
 * Also provides top-level ergonomic accessors:
 *  - items: ItemsService
 *  - collections: CollectionsService
 *  - tags: TagsService
 *  - notes: NotesService
 *  - attachments: AttachmentsService
 *  - state: StateService
 *  - curation: CurationService (QualityService)
 *  - citations: CitationService
 *  - exports: ExportService
 *  - types: ItemTypesService
 *  - upload: UploadService
 *  - retraction: RetractionService
 *  - savedSearches: SavedSearchesService
 *  - relations: RelationsService
 *
 * MICROSERVICE READY:
 * By setting NEXT_PUBLIC_LIBRARY_SERVICES_URL, NEXT_PUBLIC_LIBRARY_SERVICE_URL,
 * or NEXT_PUBLIC_LIBRARIES_SERVICE_URL, the frontend routes all requests to an
 * independent `library-services` microservice/gateway with zero component changes.
 */

import {
  CatalogService,
  ItemsService,
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  ItemTypesService,
  SavedSearchesService,
  RelationsService,
} from './catalog';

import {
  ExtractionService,
  AttachmentsService,
  UploadService,
} from './extraction';

import {
  IngestionDomainService,
  IngestionService,
  QualityService,
  CurationService,
  RetractionService,
} from './ingestion';

import {
  CitationDomainService,
  CitationService,
  ExportService,
} from './citation';

import { SearchService } from './search';
import { SyncService } from './sync';

// ─── Base URL & Per-Domain Microservice Endpoints ────────────────────────────

export const LIBRARY_SERVICES_API_BASE =
  process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL ||
  process.env.NEXT_PUBLIC_LIBRARY_SERVICE_URL ||
  process.env.NEXT_PUBLIC_LIBRARIES_SERVICE_URL ||
  '/api/v1/library';

export const LIBRARY_API_BASE = LIBRARY_SERVICES_API_BASE;

export const LIBRARY_DOMAINS = {
  catalog: process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL || `${LIBRARY_SERVICES_API_BASE}`,
  extraction: process.env.NEXT_PUBLIC_LIBRARY_EXTRACTION_URL || `${LIBRARY_SERVICES_API_BASE}`,
  ingestion: process.env.NEXT_PUBLIC_LIBRARY_INGESTION_URL || `${LIBRARY_SERVICES_API_BASE}`,
  citation: process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL || `${LIBRARY_SERVICES_API_BASE}`,
  search: process.env.NEXT_PUBLIC_LIBRARY_SEARCH_URL || `${LIBRARY_SERVICES_API_BASE}`,
  sync: process.env.NEXT_PUBLIC_LIBRARY_SYNC_URL || `${LIBRARY_SERVICES_API_BASE}`,
} as const;

export type LibraryDomainKey = keyof typeof LIBRARY_DOMAINS;

/**
 * Returns the effective API endpoint for a specific library sub-domain.
 * Supports standalone containers/pods or unified gateway routing.
 */
export function getDomainEndpoint(domain: LibraryDomainKey, path = ''): string {
  const base = LIBRARY_DOMAINS[domain] || LIBRARY_SERVICES_API_BASE;
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

// ─── Unified Library Client SDK ──────────────────────────────────────────────

export const libraryServices = {
  // ── 6 Bounded Context Modules (Microservice Ready) ────────────────────────
  catalog: CatalogService,
  extraction: ExtractionService,
  ingestion: IngestionDomainService,
  citation: CitationDomainService,
  search: SearchService,
  sync: SyncService,

  // ── Direct Ergonomic Shortcuts ───────────────────────────────────────────
  items: ItemsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  attachments: AttachmentsService,
  state: StateService,
  curation: CurationService,
  citations: CitationService,
  exports: ExportService,
  types: ItemTypesService,
  upload: UploadService,
  retraction: RetractionService,
  savedSearches: SavedSearchesService,
  relations: RelationsService,
};

// Aliases for compatibility and diverse calling conventions
export const libraryService = libraryServices;
export const LibraryServices = libraryServices;
export const LibraryService = libraryServices;

export type LibraryServices = typeof libraryServices;

export default libraryServices;
