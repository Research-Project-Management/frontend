/**
 * pages.service.ts
 *
 * UNIFIED PAGES SUBSYSTEM CLIENT SDK FACADE.
 *
 * Canonical entry point for all Pages subsystem operations:
 * - docs: Document CRUD, child files, lines, thumbnails, incremental sync
 * - compiler: LaTeX compilation, word count, preview, aux artifacts
 * - synctex: Forward and reverse SyncTeX coordinate mapping
 * - comments: Inline discussion threads, replies, and resolution
 * - suggestions: Track changes and review suggestions (accept/reject)
 * - review: Unified review & track changes threads
 * - history: Snapshots, revisions, visual diffing, and audit logs
 * - search: Full-text search and atomic batch replace across project files
 * - export: Multi-format compilation export (PDF, TeX, arXiv, DOCX, MD)
 * - structure: Project hierarchy, folders, file tree nodes, storage operations
 * - filestore: Binary file upload, streaming, signed URLs, presigned upload
 * - diagnostics: Error explanation, linter, autofix
 * - citations: BibTeX entry resolution, validation, and search
 * - templates: Project and gallery template scaffolding
 * - updater: Batch document update buffering and buffer flushing
 * - spelling: Personal & project spellcheck dictionaries
 */

import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { docs, updater, bootstrap } from './pages/docs.client';
import { compiler, synctex } from './pages/compiler.client';
import { diagnostics } from './pages/diagnostics.client';
import { review, comments, suggestions } from './pages/review.client';
import { history } from './pages/history.client';
import { exportDocs } from './pages/export.client';
import { search } from './pages/search.client';
import { structure } from './pages/structure.client';
import { filestore, linkedFiles } from './pages/filestore.client';
import { citations } from './pages/citations.client';
import { templates } from './pages/templates.client';
import { spelling } from './pages/spelling.client';
import { gitApi } from './pages/git.client';
import { ai, AiClient, suggestLatexFix } from './pages/ai.client';

export * from './pages/base';
export * from './pages/types';
export * from './pages/doc-mapper';
export * from './pages/docs.client';
export * from './pages/compiler.client';
export * from './pages/diagnostics.client';
export * from './pages/review.client';
export * from './pages/history.client';
export * from './pages/export.client';
export * from './pages/search.client';
export * from './pages/structure.client';
export * from './pages/filestore.client';
export * from './pages/citations.client';
export * from './pages/templates.client';
export * from './pages/spelling.client';
export * from './pages/git.client';
export * from './pages/ai.client';
export * from './realtime/yjs-socket-provider';
export * from './archive/archive-export';
export * from './archive/archive-import';

export const pagesService = {
  bootstrap,
  docs,
  compiler,
  synctex,
  comments,
  suggestions,
  review,
  history,
  search,
  export: exportDocs,
  structure,
  diagnostics,
  citations,
  templates,
  filestore,
  updater,
  spelling,
  ai,
  AiClient,
  suggestLatexFix,
  git: gitApi,
  linkedFiles,
  restoreProjectVersionFile: history.restoreProjectVersionFile,
  exportVersionZip: exportDocs.exportVersionZip,
  exportDocument: exportDocs.exportDocument,
  exportProjectZip: exportDocs.exportProjectZip,
  importProjectZip: exportDocs.importProjectZip,
};

latexSymbolsIndex.setSymbolsFetcher((id) => pagesService.structure.getSymbols(id));
