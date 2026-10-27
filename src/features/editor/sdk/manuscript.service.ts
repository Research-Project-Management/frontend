/**
 * manuscript.service.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK FACADE (Matt Pocock Deep Module).
 *
 * Canonical entry point for all Manuscript subsystem operations:
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
 * - linkedFiles: External file links (Zotero, Mendeley, URL, etc.)
 * - citations: BibTeX entry resolution, validation, and search
 * - templates: Project and gallery template scaffolding
 * - updater: Batch document update buffering and buffer flushing
 * - spelling: Personal spellcheck dictionary
 */

import { manuscriptService } from './manuscript/manuscript-api.client';
import { PageFileMapper, type RawPageFileRecord } from './manuscript/page-file-mapper';
import type { CollaborationEvent } from './manuscript/types';

export * from './manuscript/base';
export * from './manuscript/types';
export * from './manuscript/manuscript-api.client';
export * from './manuscript/page-file-mapper';
export * from './realtime/yjs-socket-provider';
export * from './archive/archive-export';
export * from './archive/archive-import';
export { manuscriptService, PageFileMapper, type RawPageFileRecord };
export default manuscriptService;

export const historyKeys = {
  all: ['history'] as const,
  project: (projectId: string) => ['history', 'project', projectId] as const,
  versions: (projectId: string) => ['history', 'project', projectId, 'versions'] as const,
  snapshot: (projectId: string, version: number) => ['history', 'snapshot', projectId, version] as const,
  doc: (docId: string) => ['history', 'doc', docId] as const,
  diff: (docId: string, from: string, to: string) => ['history', 'diff', docId, from, to] as const,
};

export const collaborationService = {
  createCollaborationStream: (
    projectId: string | null | undefined,
    pageId: string,
    onEvent: (event: CollaborationEvent) => void,
  ): (() => void) => {
    const url = projectId
      ? `/api/v1/manuscripts/projects/${projectId}/docs/${pageId}/collaboration/stream`
      : `/api/v1/manuscripts/docs/${pageId}/collaboration/stream`;

    const eventSource = new EventSource(url);
    eventSource.onmessage = (e: { data: string }) => {
      try {
        const parsed = JSON.parse(e.data) as CollaborationEvent;
        onEvent(parsed);
      } catch (err) {
        console.error('Failed to parse SSE collaboration event', err);
      }
    };

    return () => {
      eventSource.close();
    };
  },
};

export const listAuxFiles = (projectId: string) => manuscriptService.compiler.listAuxFiles(projectId);
export const downloadAuxFileUrl = (projectId: string, filename: string) => manuscriptService.compiler.downloadAuxFileUrl(projectId, filename);
export const downloadAllArtifactsZipUrl = (projectId: string) => manuscriptService.compiler.downloadAllArtifactsZipUrl(projectId);
export { suggestLatexFix } from './manuscript/ai-api.client';
export const fetchWordCount = async (sourceOrProjectId: string) => {
  return await manuscriptService.compiler.wordCount(sourceOrProjectId);
};
export type WordCountResponse = any;
