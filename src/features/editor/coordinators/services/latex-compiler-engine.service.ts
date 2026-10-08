/**
 * viewer.util.ts — PDF Viewer utilities, SyncTeX mapping, and compilation engine
 */

import {
  flushPageContent,
  syncIncremental,
  compileLatex,
  type CompileLatexPayload,
  type CompilerDiagnostic,
} from "./compiler.service";
import { synctexService, type ForwardSyncResult } from "./synctex.service";
import { manuscriptService } from "./manuscript.service";
import { parseCompileErrors, type ParsedCompileError } from "@/features/editor/domain/latex/latex-structure";
import { logger } from "@/shared/lib/utils";

import {
  type SyncTeXNode,
  type SyncTeXMap,
  forEachLine,
  resolvePageForLine,
  parseSyncTeX,
} from '@/features/editor/domain/document/synctex-index';

export {
  type SyncTeXNode,
  type SyncTeXMap,
  forEachLine,
  resolvePageForLine,
  parseSyncTeX,
};



// ── Thumbnail Generator ───────────────────────────────────────────────────────

export async function generateThumbnail(pdfBlob: Blob): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { pdfjs } = await import("react-pdf");
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingOp = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdf = await loadingOp.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return dataUrl.split(",")[1];
  } catch {
    return null;
  }
}

/**
 * Decodes raw PDF data from various representations (direct URL, Data URI, raw PDF binary, or Base64)
 * into a renderable URL and Blob instance for the PDF viewer.
 */
export function createPdfBlobAndUrl(rawPdf: string): { url: string; blob: Blob | null } | null {
  if (!rawPdf || typeof rawPdf !== 'string') return null;
  const trimmed = rawPdf.trim();
  if (trimmed.length === 0) return null;

  // 1. Direct URLs (HTTP, HTTPS, relative path, or existing blob)
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) {
    return { url: trimmed, blob: null };
  }

  // 2. Raw PDF binary text (starts with %PDF-)
  if (trimmed.startsWith('%PDF-')) {
    try {
      const len = trimmed.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = trimmed.charCodeAt(i) & 0xff;
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return { url: URL.createObjectURL(blob), blob };
    } catch (e) {
      logger.debug('[LatexCompilerEngine] Raw PDF binary decode error', { error: e });
    }
  }

  // 3. Base64 string or Data URI (e.g. data:application/pdf;base64,...)
  try {
    let base64 = trimmed;
    if (base64.startsWith('data:')) {
      const commaIdx = base64.indexOf(',');
      if (commaIdx !== -1) {
        base64 = base64.slice(commaIdx + 1);
      }
    }
    // Remove all whitespace (newlines, carriage returns, spaces, tabs)
    base64 = base64.replace(/\s+/g, '');

    // Ensure valid base64 padding
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), blob };
  } catch (e) {
    logger.debug('[LatexCompilerEngine] Base64 PDF decode notice', { error: e });
  }

  return null;
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
  onPhaseChange?: (phase: "flushing" | "syncing" | "compiling") => void;
  onThumbnailGenerated?: (base64: string) => void;
}

export type CompileExecutionResult =
  | {
      success: true;
      pdfUrl: string;
      pdfBlob?: Blob;
      synctexMap: SyncTeXMap | null;
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
    onPhaseChange?.("compiling");

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
        (data as any)?.compile?.outputFiles?.find(
          (f: any) => f.type === 'pdf' || f.path === 'output.pdf',
        )?.url;

      if (rawPdf && typeof rawPdf === 'string' && rawPdf.trim().length > 0) {
        const decoded = createPdfBlobAndUrl(rawPdf);
        const url = decoded?.url || null;
        const blob = decoded?.blob || null;

        if (url) {
          const synctexMap = data.synctex ? parseSyncTeX(data.synctex) : null;

          if (blob && onThumbnailGenerated) {
            generateThumbnail(blob).then((base64) => {
              if (base64) onThumbnailGenerated(base64);
            });
          }

          return {
            success: true,
            pdfUrl: url,
            pdfBlob: blob || undefined,
            synctexMap,
            rawSynctex: data.synctex || null,
            logs: data.logs || '',
            compiledAt: new Date(),
            diagnostics: data.diagnostics,
            flushedFileIds,
            flushErrors,
          };
        }
      }

      const log = data?.logs || (data as any)?.error || "Compilation finished without generating a PDF.";
      const parsedErrors = parseCompileErrors(log);

      return {
        success: false,
        error: (data as any)?.error || "LaTeX compilation failed to produce a PDF.",
        logs: log,
        errors: parsedErrors,
        diagnostics: data.diagnostics,
        flushedFileIds,
        flushErrors,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError' || currentSignal.aborted) {
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
  resolveForwardDetail(
    line: number,
    synctexMap: SyncTeXMap | null,
    activeTitle?: string,
    maxPages?: number,
  ): { page: number; x?: number; y?: number; w?: number; h?: number } | null {
    if (!synctexMap) return null;

    let targetPage: number | null = null;
    let targetNode: (SyncTeXNode & { page?: number }) | null = null;
    let targetTag: number | undefined;

    if (activeTitle && synctexMap.pathToTag) {
      const normalizedTitle = activeTitle.replace(/\\/g, '/').toLowerCase();
      const baseTitle = normalizedTitle.split('/').pop() || normalizedTitle;
      targetTag =
        synctexMap.pathToTag.get(normalizedTitle) ??
        synctexMap.pathToTag.get(baseTitle) ??
        synctexMap.pathToTag.get(`./${normalizedTitle}`);
      if (targetTag !== undefined) {
        const key = `${targetTag}:${line}`;
        if (synctexMap.tagLineToPage.has(key)) {
          targetPage = synctexMap.tagLineToPage.get(key)!;
          targetNode = synctexMap.tagLineToNode?.get(key) || null;
        }
      }
    }

    if (targetPage === null) {
      targetPage = resolvePageForLine(synctexMap, line, targetTag);
      if (targetPage !== null) {
        if (targetTag !== undefined && synctexMap.tagToSortedLines?.has(targetTag)) {
          const sorted = synctexMap.tagToSortedLines.get(targetTag)!;
          let bestLine = sorted[0];
          for (const l of sorted) {
            if (l <= line) bestLine = l;
            else break;
          }
          targetNode = synctexMap.tagLineToNode?.get(`${targetTag}:${bestLine}`) || null;
        }
        if (!targetNode) {
          const pNodes = synctexMap.pageToNodes?.get(targetPage);
          targetNode = pNodes?.find((n) => n.line === line) || pNodes?.[0] || null;
        }
      }
    }

    if (targetPage !== null && targetPage >= 1 && (!maxPages || targetPage <= maxPages)) {
      return {
        page: targetPage,
        x: targetNode?.x,
        y: targetNode?.y,
        w: targetNode?.w,
        h: targetNode?.h,
      };
    }

    return null;
  },

  /**
   * SyncTeX forward resolution (Editor line -> PDF page number)
   */
  resolveForward(
    line: number,
    synctexMap: SyncTeXMap | null,
    activeTitle?: string,
    maxPages?: number,
  ): number | null {
    return this.resolveForwardDetail(line, synctexMap, activeTitle, maxPages)?.page ?? null;
  },

  /**
   * SyncTeX reverse resolution (PDF double-click -> LaTeX source line and file)
   * Employs O(log N) binary search on y-sorted nodes with branch-and-bound geometric pruning.
   */
  resolveReverse(
    clickFraction: number,
    pageNum: number,
    synctexMap: SyncTeXMap | null,
    ptX?: number,
    ptY?: number,
  ): { sourcePath: string | null; line: number } | null {
    if (!synctexMap) return null;

    // 1. Direct page node mapping (nearest coordinate with O(log N) binary search + pruning)
    const nodes = synctexMap.pageToNodes?.get(pageNum);
    if (nodes && nodes.length > 0) {
      const targetY = ptY !== undefined ? ptY : clickFraction * 842;
      const targetX = ptX !== undefined ? ptX : undefined;

      // Binary search for node closest in y-coordinate
      let low = 0;
      let high = nodes.length - 1;
      let mid = 0;
      while (low <= high) {
        mid = (low + high) >> 1;
        if (nodes[mid].y < targetY) {
          low = mid + 1;
        } else if (nodes[mid].y > targetY) {
          high = mid - 1;
        } else {
          break;
        }
      }
      mid = Math.max(0, Math.min(nodes.length - 1, mid));

      let bestNode = nodes[mid];
      const initDy = bestNode.y - targetY;
      const initDx = targetX !== undefined ? bestNode.x - targetX : 0;
      let bestDist = initDy * initDy + 0.1 * (initDx * initDx);

      // Search downward (decreasing y): prune as soon as dy^2 >= bestDist
      for (let i = mid - 1; i >= 0; i--) {
        const n = nodes[i];
        const dy = targetY - n.y;
        if (dy * dy >= bestDist) {
          break;
        }
        const dx = targetX !== undefined ? n.x - targetX : 0;
        const dist = dy * dy + 0.1 * (dx * dx);
        if (dist < bestDist) {
          bestDist = dist;
          bestNode = n;
        }
      }

      // Search upward (increasing y): prune as soon as dy^2 >= bestDist
      for (let i = mid + 1; i < nodes.length; i++) {
        const n = nodes[i];
        const dy = n.y - targetY;
        if (dy * dy >= bestDist) {
          break;
        }
        const dx = targetX !== undefined ? n.x - targetX : 0;
        const dist = dy * dy + 0.1 * (dx * dx);
        if (dist < bestDist) {
          bestDist = dist;
          bestNode = n;
        }
      }

      if (bestNode) {
        const sourcePath = synctexMap.tagToPath?.get(bestNode.tag) || null;
        return { sourcePath, line: bestNode.line };
      }
    }

    // 2. Binary search fallback on line numbers
    const lines = synctexMap.pageToLines?.get(pageNum);
    if (lines && lines.length > 0) {
      const idx = Math.min(Math.floor(clickFraction * lines.length), lines.length - 1);
      return { sourcePath: null, line: lines[idx] };
    }

    return null;
  },
};

/**
 * Extract standard DOI from text, stripping trailing punctuation.
 */
export function extractDoiFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/);
  if (!match) return null;
  return match[1].replace(/[.,;:)\]]+$/, '');
}

/**
 * Format PDF creation date string (e.g. "D:20240515143000Z") into ISO "YYYY-MM-DD".
 */
export function parsePdfDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/D:?(\d{4})(\d{2})(\d{2})/);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

