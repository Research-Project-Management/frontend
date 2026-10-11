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
} from '@/features/editor/sdk';
import { parseCompileErrors, type ParsedCompileError } from '@/features/editor/domain/latex/latex-structure';
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
} from '@/features/editor/domain/pdf/synctex-index';
import {
  createPdfBlobAndUrl,
  type PdfBlobResult,
} from '@/features/editor/domain/pdf/pdf-resolver';

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
  try {
    const { setupPdfWorker } = await import('@/shared/lib/pdfjs-worker');
    setupPdfWorker();
    const { pdfjs } = await import('react-pdf');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingOp = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdf = await loadingOp.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    return dataUrl.split(',')[1];
  } catch {
    return null;
  }
}

// ── Compile Engine Execution Types ───────────────────────────────────────────

export interface DirtyFileItem {
  fileId: string;
  content: string;
}

export interface CompileExecutionOptions {
  projectId: string;
  pageId?: string;
  mainFile: string;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  useCache: boolean;
  forceClean?: boolean;
  stopOnFirstError?: boolean;
  dirtyFiles: DirtyFileItem[];
  source?: string;
  files?: Record<string, string>;
  onPhaseChange?: (phase: 'flushing' | 'syncing' | 'compiling') => void;
  onThumbnailGenerated?: (base64: string) => void;
}

export type CompileExecutionResult =
  | {
      success: true;
      pdfUrl: string;
      pdfBlob?: Blob;
      synctexMap: SyncTeXMap | null;
      synctexPromise?: Promise<SyncTeXMap | null>;
      rawSynctex?: string | null;
      logs: string;
      compiledAt: Date;
      diagnostics?: CompilerDiagnostic[];
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    }
  | {
      success: false;
      error: string;
      logs: string;
      errors: ParsedCompileError[];
      diagnostics?: CompilerDiagnostic[];
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    };

// Active compile controller for in-flight cancellation (Overleaf debounce & anti-stacking)
let activeCompileController: AbortController | null = null;

// ── Deep Compiler Engine ──────────────────────────────────────────────────────

export const LatexCompilerEngine = {
  /**
   * Cancels any ongoing compilation request to free server resources.
   */
  cancelInFlightCompile(): void {
    if (activeCompileController) {
      activeCompileController.abort();
      activeCompileController = null;
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
      dirtyFiles,
      onPhaseChange,
      onThumbnailGenerated,
    } = opts;

    // 1. In-flight cancellation: Abort any previous compilation still running
    if (activeCompileController) {
      activeCompileController.abort();
    }
    const controller = new AbortController();
    activeCompileController = controller;
    const currentSignal = controller.signal;

    // 2. Draft content assembly: Pass dirty files directly in payload to avoid blocking HTTP PUTs
    const flushedFileIds: string[] = dirtyFiles.map((f) => f.fileId);
    const flushErrors: Array<{ fileId: string; error: unknown }> = [];

    // Non-blocking background persistence: fires asynchronously without delaying compilation (0ms latency)
    if (dirtyFiles.length > 0 || projectId) {
      const flushTasks: Promise<any>[] = [];
      if (projectId) {
        flushTasks.push(manuscriptService.updater.flushProject(projectId).catch(() => {}));
      }
      for (const { fileId, content } of dirtyFiles) {
        flushTasks.push(
          flushPageContent(fileId, content).catch((err: unknown) => {
            logger.debug(`[LatexCompilerEngine] Background flush notice on ${fileId}`, { error: err });
          }),
        );
      }
      void Promise.allSettled(flushTasks);
    }

    // 3. Compile: Instantly enter compiling phase
    onPhaseChange?.('compiling');

    // Resolve source content from dirtyFiles, options, or active page
    let sourceContent = opts.source;
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
      main_file: mainFile,
      source: sourceContent || undefined,
      files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
      engine,
      texLiveVersion: opts.texLiveVersion,
      draft,
      use_cache: useCache,
      force_clean: opts.forceClean,
      stop_on_first_error: opts.stopOnFirstError,
    };

    try {
      const data = await compileLatex(payload, currentSignal);

      // Overleaf parity: Support data.pdf as base64 string, direct URL, or from Overleaf outputFiles
      const rawPdf =
        data?.pdf ||
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
            generateThumbnail(blob).then((base64) => {
              if (base64) onThumbnailGenerated(base64);
            });
          }

          return {
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
        success: false,
        error: data?.error || 'LaTeX compilation failed to produce a PDF.',
        logs: log,
        errors: parsedErrors,
        diagnostics: data.diagnostics,
        flushedFileIds,
        flushErrors,
      };
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError' || currentSignal.aborted) {
        logger.debug('[LatexCompilerEngine] Previous compile request aborted in favor of newer request.');
        return {
          success: false,
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

export { extractDoiFromText, parsePdfDate } from '@/features/editor/domain/pdf/pdf-resolver';

