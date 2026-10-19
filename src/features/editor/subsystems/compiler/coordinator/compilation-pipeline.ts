/**
 * compilation-pipeline.ts
 *
 * Domain pipeline for client-side compilation orchestration:
 * - PDF decoding, base64 data URL handling, and blob conversion
 * - High-speed first page thumbnail generation via PDF.js canvas rendering
 * - Non-blocking dirty file assembly and in-flight compilation cancellation
 * - High precision forward and reverse SyncTeX mapping with O(log N) geometric pruning
 * - DOI and PDF metadata date extraction
 */

import {
  manuscriptService,
  flushPageContent,
  syncIncremental,
  compileLatex,
  synctexService,
  type CompileLatexPayload,
  type CompilerDiagnostic,
  type ForwardSyncResult,
} from '@/features/editor/sdk/manuscript.service';
import { parseCompileErrors, type ParsedCompileError } from '@/features/editor/domain/latex/latex-structure';
import { sessionCoordinator } from '@/features/editor/core';
import { logger } from '@/shared/lib/utils';
import {
  type SyncTeXNode,
  type SyncTeXMap,
  forEachLine,
  resolvePageForLine,
  parseSyncTeX,
  decompressSyncTeXData,
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
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  createPdfBlobAndUrl,
  type PdfBlobResult,
};

// ── Thumbnail Generator ───────────────────────────────────────────────────────

export async function generateThumbnail(pdfBlob: Blob): Promise<string | null> {
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

// ── Compile Engine Execution Types ────────────────────────────────────────────

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
  timeoutMs?: number;
  signal?: AbortSignal;
  dirtyFiles?: DirtyFileItem[];
  onPhaseChange?: (phase: 'syncing' | 'compiling') => void;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

export interface CompileExecutionResult {
  status?: 'success' | 'error' | 'aborted';
  success: boolean;
  aborted?: boolean;
  pdfUrl?: string | null;
  pdfBlob?: Blob | null;
  rawLog?: string;
  logs?: string;
  error?: string | null;
  errors?: ParsedCompileError[];
  diagnostics?: CompilerDiagnostic[];
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

export interface CompilerExecutionEngine {
  compile(opts: CompileExecutionOptions): Promise<CompileExecutionResult>;
  cancelInFlightCompile(projectId?: string): void;
  forceSync?(projectId: string): Promise<{ synced: string[] }>;
  resolveForwardRemote?(
    projectId: string,
    file: string,
    line: number,
    column?: number,
  ): Promise<ForwardSyncResult | null>;
  resolveReverseRemote?(
    projectId: string,
    page: number,
    x: number,
    y: number,
  ): Promise<{ sourcePath: string | null; line: number } | null>;
}

export type CompilerExecutionPort = CompilerExecutionEngine;

// Active compile controller for in-flight cancellation (Overleaf debounce & anti-stacking)
let activeCompileController: AbortController | null = null;
let activeCompileProjectId: string | null = null;

// ── Deep Compiler Engine ──────────────────────────────────────────────────────

export const LatexCompilerEngine = {
  /**
   * Cancels any ongoing compilation request to free server resources.
   */
  cancelInFlightCompile(projectId?: string): void {
    const targetProjectId = projectId || activeCompileProjectId;
    if (activeCompileController) {
      activeCompileController.abort();
      activeCompileController = null;
    }
    activeCompileProjectId = null;
    if (targetProjectId) {
      void manuscriptService.compiler.cancelCompile(targetProjectId).catch(() => {});
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
      if (activeCompileProjectId) {
        void manuscriptService.compiler.cancelCompile(activeCompileProjectId).catch(() => {});
      }
    }
    const controller = new AbortController();
    activeCompileController = controller;
    activeCompileProjectId = projectId || null;
    const currentSignal = controller.signal;

    // 2. Pre-compile dirty-file sync: await non-realtime dirty file flushes before compileLatex
    //    so POST /manuscripts/compiler/compile never races against in-flight PUT /manuscripts/docs/:id requests.
    const flushedFileIds: string[] = [];
    const flushErrors: Array<{ fileId: string; error: unknown }> = [];

    if (dirtyFiles.length > 0 || projectId) {
      const flushTasks: Promise<unknown>[] = [];
      if (projectId) {
        flushTasks.push(manuscriptService.updater.flushProject(projectId).catch(() => {}));
      }
      for (const { fileId, content } of dirtyFiles) {
        if (sessionCoordinator.isRealtimeConnected(fileId)) {
          flushedFileIds.push(fileId);
          continue;
        }
        flushTasks.push(
          flushPageContent(fileId, content)
            .then(() => {
              flushedFileIds.push(fileId);
            })
            .catch((err: unknown) => {
              flushErrors.push({ fileId, error: err });
              logger.debug(`[LatexCompilerEngine] Flush notice on ${fileId}`, { error: err });
            }),
        );
      }
      await Promise.allSettled(flushTasks);
    }

    // 3. Compile: Enter compiling phase
    onPhaseChange?.('compiling');

    // Resolve source content from dirtyFiles, options, or active page
    let sourceContent = opts.source ?? opts.content;
    const filesMap: Record<string, string> = { ...(opts.files || {}) };

    for (const item of dirtyFiles) {
      if (!sourceContent && (item.fileId === pageId || item.fileId === mainFile)) {
        sourceContent = item.content;
      }
      filesMap[item.fileId] = item.content;
    }

    const payload: CompileLatexPayload = {
      project_id: projectId || undefined,
      page_id: pageId || undefined,
      main_file: mainFile ?? null,
      source: sourceContent || undefined,
      files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
      engine: engine ?? 'pdflatex',
      texLiveVersion: opts.texLiveVersion,
      draft: draft ?? false,
      use_cache: useCache ?? true,
      force_clean: opts.forceClean,
      stop_on_first_error: opts.stopOnFirstError,
    };

    try {
      if (currentSignal.aborted) {
        logger.debug('[LatexCompilerEngine] Compile request was aborted before execution.');
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

      const data = await compileLatex(payload, currentSignal);

      if (currentSignal.aborted || data?.error?.toLowerCase().includes('aborted')) {
        logger.debug('[LatexCompilerEngine] Compile request aborted or superseded.');
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

      // Overleaf parity: Support data.pdf, data.pdfUrl, or from Overleaf outputFiles
      const rawPdf =
        data?.pdf ||
        (data as { pdfUrl?: string })?.pdfUrl ||
        data?.compile?.outputFiles?.find(
          (f) => f.type === 'pdf' || f.path === 'output.pdf',
        )?.url;

      if (rawPdf && typeof rawPdf === 'string' && rawPdf.trim().length > 0) {
        const decoded = createPdfBlobAndUrl(rawPdf);
        const url = decoded?.url || null;
        const blob = decoded?.blob || null;

        if (url) {
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
            : Promise.resolve<SyncTeXMap | null>(null);

          if (blob && onThumbnailGenerated) {
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

          return {
            status: 'success',
            success: true,
            pdfUrl: url,
            pdfBlob: blob || undefined,
            synctexMap: initialSyncMap,
            synctexPromise,
            rawSynctex: data.synctex || null,
            logs: data.logs || '',
            compiledAt: new Date(),
            diagnostics: data.diagnostics,
            flushedFileIds,
            flushErrors,
          };
        }
      }

      const log = data?.logs || data?.error || 'Compilation finished without generating a PDF.';
      const parsedErrors = parseCompileErrors(log);

      return {
        status: 'error',
        success: false,
        error: data?.error || 'LaTeX compilation failed to produce a PDF.',
        logs: log,
        errors: parsedErrors,
        diagnostics: data.diagnostics,
        flushedFileIds,
        flushErrors,
      };
    } catch (err: unknown) {
      const isAborted =
        (err as { name?: string })?.name === 'AbortError' ||
        (err as Error)?.message?.toLowerCase().includes('aborted') ||
        currentSignal.aborted;

      if (isAborted) {
        logger.debug('[LatexCompilerEngine] Previous compile request aborted in favor of newer request.');
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

      const errStr = err instanceof Error ? err.message : String(err);
      const parsedErrors = parseCompileErrors(errStr);

      return {
        status: 'error',
        success: false,
        error: errStr,
        logs: errStr,
        errors: parsedErrors,
        flushedFileIds,
        flushErrors,
      };
    } finally {
      if (activeCompileController === controller) {
        activeCompileController = null;
      }
    }
  },

  forceSync(projectId: string): Promise<{ synced: string[] }> {
    return syncIncremental(projectId, [], true);
  },

  /**
   * Forward SyncTeX via Backend Single Source of Truth
   */
  async resolveForwardRemote(
    projectId: string,
    file: string,
    line: number,
    column: number = 0,
  ): Promise<ForwardSyncResult | null> {
    try {
      const res = await synctexService.forwardSync({
        projectId,
        file,
        line,
        column,
      });
      return res ?? null;
    } catch (err) {
      logger.debug('[LatexCompilerEngine] Remote forward sync failed', { err });
      return null;
    }
  },

  /**
   * Reverse SyncTeX via Backend Single Source of Truth
   */
  async resolveReverseRemote(
    projectId: string,
    page: number,
    x: number,
    y: number,
  ): Promise<{ sourcePath: string | null; line: number } | null> {
    try {
      const res = await synctexService.reverseSync({
        projectId,
        page,
        x,
        y,
      });
      if (res && res.line) {
        return { sourcePath: res.file || null, line: res.line };
      }
      return null;
    } catch (err) {
      logger.debug('[LatexCompilerEngine] Remote reverse sync failed', { err });
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

