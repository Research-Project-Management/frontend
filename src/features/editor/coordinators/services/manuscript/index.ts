/**
 * index.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK
 *
 * Single point of contact for the frontend to interact with the Manuscript subsystem.
 * Encapsulates all sub-domains:
 *  - docs: Document CRUD, lines, thumbnails, and sync
 *  - compiler: LaTeX compilation, aux artifacts, word-count, preview
 *  - synctex: Forward and reverse SyncTeX coordinate mapping
 *  - comments: Inline discussion threads, replies, and resolution
 *  - suggestions: Track changes and review suggestions (accept/reject)
 *  - review: Review & track changes threads and changes
 *  - history: Snapshots, revisions, visual diffing, and audit logs
 *  - search: Full-text search and atomic batch replace across project files
 *  - export: Multi-format compilation export (PDF, TeX, arXiv ZIP, DOCX, MD)
 *  - collaboration: Real-time presence, heartbeat, and SSE synchronization
 *  - structure: Project hierarchy, folders, and file tree nodes
 *  - diagnostics: Error explanation, linter, autofix
 *  - linkedFiles: URL, Zotero, Mendeley, Dropbox, GitHub external file links
 *  - citations: BibTeX entry resolution, validation, and search
 *  - templates: Project and gallery template scaffolding
 *  - filestore: Binary file upload, streaming, and signed URLs
 *  - updater: Batch document update buffering and buffer flushing
 *  - spelling: Personal spellcheck dictionary
 */

import { docs } from './docs.api';
import { compiler } from './compiler.api';
import { synctex } from './synctex.api';
import { comments } from './comments.api';
import { suggestions } from './suggestions.api';
import { review } from './review.api';
import { history } from './history.api';
import { search } from './search.api';
import { exportDocs } from './export.api';
import { collaboration } from './collaboration.api';
import { structure } from './structure.api';
import { diagnostics } from './diagnostics.api';
import { linkedFiles } from './linked-files.api';
import { citations } from './citations.api';
import { templates } from './templates.api';
import { filestore } from './filestore.api';
import { updater } from './updater.api';
import { spellingService } from '../spelling.service';

export * from './base';
export * from './types';
export * from './docs.api';
export * from './compiler.api';
export * from './synctex.api';
export * from './comments.api';
export * from './suggestions.api';
export * from './review.api';
export * from './history.api';
export * from './search.api';
export * from './export.api';
export * from './collaboration.api';
export * from './structure.api';
export * from './diagnostics.api';
export * from './linked-files.api';
export * from './citations.api';
export * from './templates.api';
export * from './filestore.api';
export * from './updater.api';

export const manuscriptService = {
  docs,
  compiler,
  synctex,
  comments,
  suggestions,
  review,
  trackChanges: review,
  history,
  search,
  export: exportDocs,
  exportImport: exportDocs,
  collaboration,
  structure,
  diagnostics,
  linkedFiles,
  citations,
  templates,
  filestore,
  updater,
  spelling: spellingService,
};

export default manuscriptService;
