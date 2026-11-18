/**
 * pages.service.ts
 *
 * UNIFIED PAGES / MANUSCRIPT CLIENT SDK FACADE (Matt Pocock Deep Module).
 *
 * Canonical entry point for all Pages/Manuscript subsystem operations:
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
 * - spelling: Personal spellcheck dictionary
 */

import { manuscriptService } from './pages/docstore.client';
import { getManuscriptsBaseUrl } from './pages/base';
import { getAuthToken } from '@/shared/lib/api';
import { PageFileMapper, type RawPageFileRecord } from './pages/doc-mapper';
import type { CollaborationEvent } from './pages/types';

export * from './pages/base';
export * from './pages/types';
export * from './pages/docstore.client';
export * from './pages/doc-mapper';
export {
  mapStructureNodesToStorageItems,
  mapStructureNodesToPageFiles,
} from './pages/structure.client';
export * from './realtime/yjs-socket-provider';
export * from './archive/archive-export';
export * from './archive/archive-import';
export const pagesService = manuscriptService;
export const PagesService = manuscriptService;
export const ManuscriptService = PagesService;
export { manuscriptService, PageFileMapper, type RawPageFileRecord };
export default manuscriptService;

export const historyKeys = {
  all: ['history'] as const,
  project: (projectId: string) => ['history', 'project', projectId] as const,
  versions: (projectId: string, pageId?: string) =>
    pageId
      ? (['history', 'project', projectId, 'page', pageId, 'versions'] as const)
      : (['history', 'project', projectId, 'versions'] as const),
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
    const base = getManuscriptsBaseUrl().replace(/\/$/, '');
    const url = projectId
      ? `${base}/spaces/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(pageId)}/collaboration/stream`
      : `${base}/docs/${encodeURIComponent(pageId)}/collaboration/stream`;

    const token = getAuthToken();

    if (typeof EventSource !== 'undefined') {
      const streamUrl = token
        ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : url;
      const eventSource = new EventSource(streamUrl, { withCredentials: true });
      eventSource.onmessage = (e: { data: string }) => {
        try {
          onEvent(JSON.parse(e.data) as CollaborationEvent);
        } catch (err) {
          console.error('Failed to parse SSE collaboration event', err);
        }
      };
      return () => {
        eventSource.close();
      };
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLines = frame
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart());
            if (dataLines.length === 0) continue;
            try {
              const parsed = JSON.parse(dataLines.join('\n')) as CollaborationEvent;
              onEvent(parsed);
            } catch (err) {
              console.error('Failed to parse SSE collaboration event', err);
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.debug('Collaboration SSE stream closed', err);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  },
};

export const listAuxFiles = (
  pageOrProjectId: string,
  options?: { isPageScoped?: boolean },
) => manuscriptService.compiler.listAuxFiles(pageOrProjectId, options);
export const downloadAuxFileUrl = (
  pageOrProjectId: string,
  filename: string,
  options?: { isPageScoped?: boolean },
) => manuscriptService.compiler.downloadAuxFileUrl(pageOrProjectId, filename, options);
export const downloadAllArtifactsZipUrl = (
  pageOrProjectId: string,
  options?: { isPageScoped?: boolean },
) => manuscriptService.compiler.downloadAllArtifactsZipUrl(pageOrProjectId, options);
export { suggestLatexFix } from './pages/ai.client';
export const fetchWordCount = async (
  source: string,
  projectId?: string,
  options?: {
    includeBib?: boolean;
    filename?: string;
    files?: Record<string, string>;
  },
) => {
  return await manuscriptService.compiler.wordCount(source, projectId, options);
};
export const restoreProjectVersionFile = (
  projectId: string,
  version: number,
  pathname: string,
  fileId?: string,
  options?: { pageId?: string },
) => manuscriptService.history.restoreProjectVersionFile(projectId, version, pathname, fileId, options);
export const exportVersionZip = (
  projectId: string,
  version: number | string,
  projectName?: string,
  options?: { pageId?: string },
) => manuscriptService.export.exportVersionZip(projectId, version, projectName, options);
