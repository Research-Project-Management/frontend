/**
 * compile-pipeline.ts
 *
 * Domain pipeline for client-side compilation orchestration:
 * - PDF decoding, base64 data URL handling, and blob conversion
 * - High-speed first page thumbnail generation via PDF.js canvas rendering
 * - Non-blocking dirty file assembly and in-flight compilation cancellation
 * - High precision forward and reverse SyncTeX mapping with O(log N) geometric pruning
 * - DOI and PDF metadata date extraction
 */

import {
  pagesService,
  type CompileLatexPayload,
  type CompileLogMeta,
  type CompileOutcome,
  type CompileValidationIssue,
  type CompilerDiagnostic,
  type DiagnosticsSummary,
  type ForwardSyncResult,
} from '@/features/editor/sdk/pages.service';
import { parseCompileErrors, type ParsedCompileError } from '@/features/editor/domain/latex/latex-structure';
import { sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { logger } from '@/shared/lib/utils';
import { DEFAULT_COMPILER_ENGINE } from '@/features/editor/domain/types/compiler.types';
import {
  type SyncTeXNode,
  type SyncTeXMap,
  forEachLine,
  resolvePageForLine,
  parseSyncTeX,
  decompressSyncTeXData,
  decompressSyncTeXBytes,
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import {
  createPdfBlobAndUrl,
  type PdfBlobResult,
} from '@/features/editor/subsystems/compiler/synctex/pdf-resolver';

export {
  type SyncTeXNode,
  type SyncTeXMap,
  forEachLine,
  resolvePageForLine,
  parseSyncTeX,
  decompressSyncTeXData,
  decompressSyncTeXBytes,
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  createPdfBlobAndUrl,
  type PdfBlobResult,
};

// â”€â”€ Thumbnail Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function generateThumbnail(pdfBlob: Blob): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  let loadingOp: ReturnType<(typeof import('react-pdf'))['pdfjs']['getDocument']> | null = null;
  let pdf: import('pdfjs-dist').PDFDocumentProxy | null = null;
  let page: import('pdfjs-dist').PDFPageProxy | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    const { setupPdfWorker } = await import('@/shared/lib/pdfjs-worker');
    setupPdfWorker();
    const { pdfjs } = await import('react-pdf');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    loadingOp = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    pdf = await loadingOp.promise;
    page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.6 });
    canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return dataUrl.split(',')[1];
  } catch {
    return null;
  } finally {
    try {
      page?.cleanup();
      await pdf?.cleanup();
      await pdf?.destroy();
      await loadingOp?.destroy();
    } catch {
      // Ignore worker destruction errors during shutdown
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

// â”€â”€ Compile Engine Execution Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { CompilerDiagnostic, ForwardSyncResult };

export interface DirtyFileItem {
  fileId: string;
  id?: string;
  path?: string;
  content: string;
}

export interface FlushBarrierDeps {
  dirtyFiles: DirtyFileItem[];
  projectId?: string;
  pageId?: string;
}

export interface CompileExecutionOptions {
  projectId: string;
  pageId?: string;
  content?: string;
  source?: string;
  files?: Record<string, string>;
  mainFile?: string;
  engine?: string;
  texLiveVersion?: string;
  draft?: boolean;
  useCache?: boolean;
  forceClean?: boolean;
  stopOnFirstError?: boolean;
  priority?: 'manual' | 'auto';
  timeoutMs?: number;
  signal?: AbortSignal;
  dirtyFiles?: DirtyFileItem[];
  onPhaseChange?: (phase: 'syncing' | 'compiling') => void;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

export interface CompileExecutionResult {
  status?: 'success' | 'error' | 'aborted';
  outcome?: CompileOutcome;
  success: boolean;
  aborted?: boolean;
  pdfUrl?: string | null;
  pdfBlob?: Blob | null;
  rawLog?: string;
  logs?: string;
  logMeta?: CompileLogMeta;
  error?: string | null;
  errorCode?: string;
  statusCode?: number;
  errors?: ParsedCompileError[];
  diagnostics?: CompilerDiagnostic[];
  diagnosticsSummary?: DiagnosticsSummary;
  validationIssues?: CompileValidationIssue[];
  rawSynctex?: string | null;
  synctexData?: string | null;
  synctexPath?: string | null;
  synctexMap?: SyncTeXMap | null;
  synctexPromise?: Promise<SyncTeXMap | null>;
  compileDurationMs?: number | null;
  compiledAt?: Date | number | null;
  buildId?: string;
  cached?: boolean;
  flushedFileIds?: string[];
  flushErrors?: Array<{ fileId: string; error: unknown }>;
}

export interface CompilerPort {
  compile(opts: CompileExecutionOptions): Promise<CompileExecutionResult>;
  cancelInFlightCompile(projectId?: string): void;
  forceSync?(projectId: string): Promise<{ synced: string[] }>;
  resolveForwardRemote?(
    projectId: string,
    file: string,
    line: number,
    column?: number,
    pageId?: string,
  ): Promise<ForwardSyncResult | null>;
  resolveReverseRemote?(
    projectId: string,
    page: number,
    x: number,
    y: number,
    pageId?: string,
  ): Promise<{ sourcePath: string | null; line: number } | null>;
}

// Active compile controller for in-flight cancellation (debounce & anti-stacking)
let activeCompileController: AbortController | null = null;
let activeCompileTargetId: string | null = null;

// â”€â”€ Deep Compile Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const CompilePipeline = {
  /**
   * Cancels any ongoing compilation request to free server resources.
   */
  cancelInFlightCompile(projectId?: string): void {
    const targetId = projectId || activeCompileTargetId;
    if (activeCompileController) {
      activeCompileController.abort();
      activeCompileController = null;
    }
    activeCompileTargetId = null;
    if (targetId) {
      void pagesService.compiler.cancelCompile(targetId).catch(() => {});
    }
  },

  async compile(opts: CompileExecutionOptions): Promise<CompileExecutionResult> {
    const {
      projectId,
      pageId,
      mainFile,
      engine,
      draft,
      useCache,
      onPhaseChange,
      onThumbnailGenerated,
    } = opts;
    const dirtyFiles = opts.dirtyFiles ?? [];

    // 1. In-flight cancellation: Abort any previous compilation still running
    if (activeCompileController) {
      activeCompileController.abort();
      if (activeCompileTargetId) {
        void pagesService.compiler.cancelCompile(activeCompileTargetId).catch(() => {});
      }
    }
    const controller = new AbortController();
    if (opts.signal) {
      if (opts.signal.aborted) {
        controller.abort();
      } else {
        opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }
    activeCompileController = controller;
    activeCompileTargetId = pageId || projectId || null;
    const currentSignal = controller.signal;

    // 2. Pre-compile dirty-file sync: await non-realtime dirty file flushes if not already flushed
    //    by FlushBarrier so POST /manuscripts/compile never races against in-flight PUTs.
    const flushedFileIds: string[] = [];
    const flushErrors: Array<{ fileId: string; error: unknown }> = [];

    if (dirtyFiles.length > 0) {
      const flushTasks: Promise<unknown>[] = [];
      for (const { fileId } of dirtyFiles) {
        if (sessionCoordinator.isRealtimeConnected(fileId)) {
          flushedFileIds.push(fileId);
          continue;
        }
        // If sessionCoordinator already flushed this file (via FlushBarrier)
        // and its LRU model is now clean, skip redundant flush.
        if (!lruDocumentCache.isDirty(fileId)) {
          flushedFileIds.push(fileId);
          continue;
        }
        flushTasks.push(
          sessionCoordinator
            .flushFile(fileId)
            .then((ok) => {
              if (ok) {
                flushedFileIds.push(fileId);
              }
            })
            .catch((err: unknown) => {
              flushErrors.push({ fileId, error: err });
              logger.debug(`[CompilePipeline] Flush notice on ${fileId}`, { error: err });
            }),
        );
      }
      if (flushTasks.length > 0) {
        await Promise.allSettled(flushTasks);
      }
    }

    // 3. Compile: Enter compiling phase
    onPhaseChange?.('compiling');

    const isPersistedProject = Boolean(projectId);
    let payload: CompileLatexPayload;

    if (isPersistedProject) {
      // DB + Yjs flush on backend is authoritative; only forward overlay for files still dirty.
      const failedFlushIds = new Set(flushErrors.map((e) => e.fileId));
      const flushedSet = new Set(flushedFileIds);
      const overlayFiles: Record<string, string> = {};

      for (const item of dirtyFiles) {
        const stillDirty =
          lruDocumentCache.isDirty(item.fileId) ||
          failedFlushIds.has(item.fileId) ||
          !flushedSet.has(item.fileId);
        if (!stillDirty) continue;

        const resolvedPath = item.path || lruDocumentCache.getModel(item.fileId)?.filePath;
        const latestContent = lruDocumentCache.getContent(item.fileId) ?? item.content;
        if (resolvedPath) {
          overlayFiles[resolvedPath] = latestContent;
        } else {
          overlayFiles[item.fileId] = latestContent;
        }
      }

      for (const model of lruDocumentCache.getDirtyModels()) {
        const canonicalPath =
          model.filePath && model.filePath !== model.fileId ? model.filePath : undefined;
        if (canonicalPath && !(canonicalPath in overlayFiles)) {
          overlayFiles[canonicalPath] = model.content;
        } else if (!canonicalPath && !(model.fileId in overlayFiles) && Object.keys(overlayFiles).length === 0) {
          overlayFiles[model.fileId] = model.content;
        }
      }

      payload = {
        spaceId: projectId || undefined,
        pageId: pageId || undefined,
        mainFile: mainFile || undefined,
        files: Object.keys(overlayFiles).length > 0 ? overlayFiles : undefined,
        engine: engine ?? DEFAULT_COMPILER_ENGINE,
        texLiveVersion: opts.texLiveVersion,
        draft: draft ?? false,
        useCache: useCache ?? true,
        forceClean: opts.forceClean,
        stopOnFirstError: opts.stopOnFirstError,
        ...(opts.priority ? { priority: opts.priority } : {}),
        responseMode: 'artifact',
        ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
      };
    } else {
      // Ad-hoc / unpersisted compile: resolve inline source and virtual files map
      let sourceContent = opts.source ?? opts.content;
      const rawFilesMap: Record<string, string> = { ...(opts.files || {}) };

      for (const item of dirtyFiles) {
        if (!sourceContent && (item.fileId === pageId || item.fileId === mainFile)) {
          sourceContent = item.content;
        }
        const resolvedPath = item.path || lruDocumentCache.getModel(item.fileId)?.filePath;
        if (resolvedPath) {
          rawFilesMap[resolvedPath] = item.content;
        } else if (!(item.fileId in rawFilesMap) && Object.keys(rawFilesMap).length === 0) {
          rawFilesMap[item.fileId] = item.content;
        }
      }

      // Deduplicate raw UUID aliases if a canonical relative path (with extension or slash) already exists
      const filesMap: Record<string, string> = {};
      const rawEntries = Object.entries(rawFilesMap);
      const hasCanonicalPaths = rawEntries.some(([k]) => k.includes('.') || k.includes('/'));
      for (const [key, val] of rawEntries) {
        const isUuidLike =
          !key.includes('.') &&
          !key.includes('/') &&
          (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key) ||
            dirtyFiles.some((d) => d.fileId === key && (d.path || lruDocumentCache.getModel(d.fileId)?.filePath)));
        if (hasCanonicalPaths && isUuidLike && key !== mainFile) {
          continue;
        }
        filesMap[key] = val;
      }

      payload = {
        spaceId: projectId || undefined,
        pageId: pageId || undefined,
        mainFile: mainFile || undefined,
        source: sourceContent || undefined,
        files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
        engine: engine ?? DEFAULT_COMPILER_ENGINE,
        texLiveVersion: opts.texLiveVersion,
        draft: draft ?? false,
        useCache: useCache ?? true,
        forceClean: opts.forceClean,
        stopOnFirstError: opts.stopOnFirstError,
        ...(opts.priority ? { priority: opts.priority } : {}),
        responseMode: 'inline',
        ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
      };
    }

    try {
      if (currentSignal.aborted) {
        logger.debug('[CompilePipeline] Compile request was aborted before execution.');
        return {
          status: 'aborted',
          success: false,
          aborted: true,
          error: 'Compilation superseded',
          logs: '',
          errors: [],
          flushedFileIds: [],
          flushErrors: [],
        };
      }

      const data = await pagesService.compiler.compile(payload, currentSignal);

      if (currentSignal.aborted || data?.error?.toLowerCase().includes('aborted')) {
        logger.debug('[CompilePipeline] Compile request aborted or superseded.');
        return {
          status: 'aborted',
          success: false,
          aborted: true,
          error: 'Compilation superseded',
          logs: '',
          errors: [],
          flushedFileIds: [],
          flushErrors: [],
        };
      }

      const rawPdf = data?.pdf;
      const hasInlinePdf = Boolean(rawPdf && typeof rawPdf === 'string' && rawPdf.trim().length > 0);
      const artifactUrl = data?.pdfArtifactUrl;

      let resolvedPdf: PdfBlobResult | null = null;
      if (hasInlinePdf) {
        resolvedPdf = createPdfBlobAndUrl(rawPdf);
      } else if (
        data?.success &&
        artifactUrl &&
        typeof pagesService.compiler.fetchArtifactBlob === 'function'
      ) {
        resolvedPdf = await pagesService.compiler.fetchArtifactBlob(artifactUrl, currentSignal);
      }

      const isBuildSuccess = data?.success !== false;

      if (resolvedPdf?.url) {
        const url = resolvedPdf.url;
        const blob = resolvedPdf.blob;

        // Fast-path: small plain text synctex parses immediately for testing & small docs
        const isSmallOrPlain = Boolean(
          data.synctex && !data.synctex.trimStart().startsWith('H4sI') && (data.synctex.startsWith('SyncTeX') || data.synctex.length < 5000),
        );
        let initialSyncMap: SyncTeXMap | null = null;
        if (isSmallOrPlain && data.synctex) {
          try {
            initialSyncMap = parseSyncTeX(data.synctex);
          } catch {}
        }

        // Offload heavy decompression and parsing to non-blocking promise for 0ms immediate PDF display
        const synctexPayload = data.synctex;
        const synctexUrl = data.synctexArtifactUrl;
        const synctexPromise = synctexPayload
          ? (async () => {
              if (initialSyncMap) return initialSyncMap;
              try {
                const rawSyncTex = await decompressSyncTeXData(synctexPayload);
                return rawSyncTex ? parseSyncTeX(rawSyncTex) : null;
              } catch {
                return null;
              }
            })()
          : synctexUrl && typeof pagesService.compiler.fetchArtifactArrayBuffer === 'function'
            ? (async () => {
                try {
                  const buf = await pagesService.compiler.fetchArtifactArrayBuffer(synctexUrl, currentSignal);
                  if (!buf) return null;
                  const rawSyncTex = await decompressSyncTeXBytes(buf);
                  return rawSyncTex ? parseSyncTeX(rawSyncTex) : null;
                } catch {
                  return null;
                }
              })()
            : Promise.resolve<SyncTeXMap | null>(null);

        if (isBuildSuccess && blob && onThumbnailGenerated) {
          const runGen = () => {
            generateThumbnail(blob).then((base64) => {
              if (base64) onThumbnailGenerated(base64);
            });
          };
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(runGen, { timeout: 2000 });
          } else {
            setTimeout(runGen, 150);
          }
        }

        if (!isBuildSuccess) {
          const log = data?.logs || data?.error || '';
          const parsedErrors = parseCompileErrors(log, data?.diagnostics);
          const partialOutcome: CompileOutcome =
            data?.outcome ||
            (opts.stopOnFirstError ? 'stopped-on-first-error' : 'failure');
          return {
            status: 'error',
            outcome: partialOutcome,
            success: false,
            pdfUrl: url,
            pdfBlob: blob || undefined,
            synctexMap: initialSyncMap,
            synctexPromise,
            rawSynctex: data.synctex || null,
            error: data?.error || 'LaTeX compilation completed with errors',
            errorCode: data?.errorCode,
            statusCode: data?.statusCode,
            logs: log,
            logMeta: data.logMeta,
            errors: parsedErrors,
            diagnostics: data.diagnostics,
            diagnosticsSummary: data.diagnosticsSummary,
            validationIssues: data.validationIssues,
            flushedFileIds,
            flushErrors,
          };
        }

        return {
          status: 'success',
          outcome: data.outcome || 'success',
          success: true,
          pdfUrl: url,
          pdfBlob: blob || undefined,
          synctexMap: initialSyncMap,
          synctexPromise,
          rawSynctex: data.synctex || null,
          logs: data.logs || '',
          logMeta: data.logMeta,
          compiledAt: new Date(),
          diagnostics: data.diagnostics,
          diagnosticsSummary: data.diagnosticsSummary,
          flushedFileIds,
          flushErrors,
        };
      }

      const log = data?.logs || data?.error || 'Compilation finished without generating a PDF.';
      const outcome: CompileOutcome =
        data?.outcome ||
        (opts.stopOnFirstError ? 'stopped-on-first-error' : 'failure');
      const isNonCodeOutcome =
        outcome === 'rate-limited' ||
        outcome === 'clsi-unavailable' ||
        outcome === 'validation-problems';
      const parsedErrors = isNonCodeOutcome
        ? []
        : parseCompileErrors(log, data?.diagnostics);

      return {
        status: 'error',
        outcome,
        success: false,
        error: data?.error || 'LaTeX compilation failed to produce a PDF.',
        errorCode: data?.errorCode,
        statusCode: data?.statusCode,
        logs: log,
        logMeta: data?.logMeta,
        errors: parsedErrors,
        diagnostics: isNonCodeOutcome ? [] : data?.diagnostics,
        diagnosticsSummary: data?.diagnosticsSummary,
        validationIssues: data?.validationIssues,
        flushedFileIds,
        flushErrors,
      };
    } catch (err: unknown) {
      const isAborted =
        (err as { name?: string })?.name === 'AbortError' ||
        (err as Error)?.message?.toLowerCase().includes('aborted') ||
        currentSignal.aborted;

      if (isAborted) {
        logger.debug('[CompilePipeline] Previous compile request aborted in favor of newer request.');
        return {
          status: 'aborted',
          outcome: 'terminated',
          success: false,
          aborted: true,
          error: 'Compilation superseded',
          logs: '',
          errors: [],
          flushedFileIds: [],
          flushErrors: [],
        };
      }

      const errStr = err instanceof Error ? err.message : String(err);
      const isInfraError =
        /failed to fetch|network|econnrefused|503|service unavailable|clsi/i.test(
          errStr,
        );
      const parsedErrors = isInfraError ? [] : parseCompileErrors(errStr);

      return {
        status: 'error',
        outcome: isInfraError ? 'clsi-unavailable' : 'failure',
        success: false,
        error: errStr,
        logs: errStr,
        errors: parsedErrors,
        diagnostics: isInfraError ? [] : undefined,
        flushedFileIds,
        flushErrors,
      };
    } finally {
      if (activeCompileController === controller) {
        activeCompileController = null;
        activeCompileTargetId = null;
      }
    }
  },

  forceSync(projectId: string): Promise<{ synced: string[] }> {
    return pagesService.docs.syncIncremental(projectId, [], true);
  },

  /**
   * Remote forward SyncTeX resolution via Backend Single Source of Truth
   */
  async resolveForwardRemote(
    projectId: string,
    file: string,
    line: number,
    column: number = 0,
    pageId?: string,
  ): Promise<ForwardSyncResult | null> {
    try {
      const res = await pagesService.synctex.forwardSync({
        spaceId: projectId,
        ...(pageId ? { pageId } : {}),
        file,
        line,
        column,
      });
      return res ?? null;
    } catch (err) {
      logger.debug('[CompilePipeline] Remote forward sync failed', { err });
      return null;
    }
  },

  /**
   * Remote reverse SyncTeX resolution via Backend Single Source of Truth
   */
  async resolveReverseRemote(
    projectId: string,
    page: number,
    x: number,
    y: number,
    pageId?: string,
  ): Promise<{ sourcePath: string | null; line: number } | null> {
    try {
      const res = await pagesService.synctex.reverseSync({
        spaceId: projectId,
        ...(pageId ? { pageId } : {}),
        page,
        x,
        y,
      });
      if (res && res.line) {
        return { sourcePath: res.file || null, line: res.line };
      }
      return null;
    } catch (err) {
      logger.debug('[CompilePipeline] Remote reverse sync failed', { err });
      return null;
    }
  },

  /**
   * SyncTeX forward resolution with coordinate detail
   */
  resolveForwardDetail,

  /**
   * SyncTeX forward resolution (Editor line -> PDF page number)
   */
  resolveForward,

  /**
   * SyncTeX reverse resolution (PDF double-click -> LaTeX source line and file)
   * Employs O(log N) binary search on y-sorted nodes with branch-and-bound geometric pruning.
   */
  resolveReverse,
};

export { extractDoiFromText, parsePdfDate } from '@/features/editor/subsystems/compiler/synctex/pdf-resolver';
