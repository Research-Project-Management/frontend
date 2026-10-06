/**
 * viewer.util.ts — PDF Viewer utilities, SyncTeX mapping, and compilation engine
 */

import {
  flushPageContent,
  syncIncremental,
  compileLatex,
  type CompileLatexPayload,
  type CompilerDiagnostic,
} from "../services/compiler.service";
import { synctexService, type ForwardSyncResult } from "../services/synctex.service";
import { manuscriptService } from "../services/manuscript.service";
import { parseCompileErrors, type ParsedCompileError } from "./editor.util";
import { logger } from "@/shared/lib/utils";

// ── SyncTeX Map & Node Types ──────────────────────────────────────────────────

export interface SyncTeXNode {
  line: number;
  tag: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface SyncTeXMap {
  lineToPage: Map<number, number>;
  tagLineToPage: Map<string, number>;
  pageToLines: Map<number, number[]>;
  sortedLines: number[];
  pageToNodes: Map<number, SyncTeXNode[]>;
  tagLineToNode: Map<string, SyncTeXNode & { page: number }>;
  tagToPath: Map<number, string>;
  pathToTag: Map<string, number>;
}

/**
 * Memory-efficient zero-allocation line scanner for large text streams.
 */
export function forEachLine(text: string, callback: (line: string) => void): void {
  let start = 0;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = len;
    let lineEnd = end;
    if (lineEnd > start && text.charCodeAt(lineEnd - 1) === 13 /* \r */) {
      lineEnd--;
    }
    callback(text.substring(start, lineEnd));
    start = end + 1;
  }
}

/**
 * Resolves the page number for a given line, with tag matching and O(log M) binary search fallback.
 */
export function resolvePageForLine(
  synctexMap: SyncTeXMap | null | undefined,
  line: number,
  tag?: number,
  maxTolerance: number = 5,
): number | null {
  if (!synctexMap) return null;

  if (tag !== undefined) {
    const key = `${tag}:${line}`;
    if (synctexMap.tagLineToPage.has(key)) {
      return synctexMap.tagLineToPage.get(key)!;
    }
  }

  if (synctexMap.lineToPage.has(line)) {
    return synctexMap.lineToPage.get(line)!;
  }

  const sorted = synctexMap.sortedLines;
  if (!sorted || sorted.length === 0) return null;

  // Binary search for nearest preceding line (<= line)
  let low = 0;
  let high = sorted.length - 1;
  let bestCandidate: number | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midVal = sorted[mid];
    if (midVal === line) {
      bestCandidate = midVal;
      break;
    } else if (midVal < line) {
      bestCandidate = midVal;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestCandidate !== null && (line - bestCandidate) <= maxTolerance) {
    return synctexMap.lineToPage.get(bestCandidate) ?? null;
  }

  return null;
}

/**
 * Parse a decompressed SyncTeX text into a coordinate-aware map.
 */
export function parseSyncTeX(text: string): SyncTeXMap {
  const lineToPage = new Map<number, number>();
  const tagLineToPage = new Map<string, number>();
  const pageToLines = new Map<number, number[]>();
  const pageToNodes = new Map<number, SyncTeXNode[]>();
  const tagLineToNode = new Map<string, SyncTeXNode & { page: number }>();
  const tagToPath = new Map<number, string>();
  const pathToTag = new Map<string, number>();
  let currentPage = 0;

  forEachLine(text, (raw) => {
    const s = raw.trimEnd();
    if (!s) return;

    if (s.startsWith("Input:")) {
      const parts = s.split(":");
      if (parts.length >= 3) {
        const tag = parseInt(parts[1], 10);
        const filepath = parts.slice(2).join(":").trim();
        tagToPath.set(tag, filepath);

        const normalized = filepath.replace(/\\/g, '/').toLowerCase();
        const basename = normalized.split("/").pop() || normalized;
        pathToTag.set(basename, tag);
        pathToTag.set(normalized, tag);
        pathToTag.set(normalized.replace(/^\.\//, ''), tag);
      }
      return;
    }

    const first = s.charCodeAt(0);

    if (first === 123 /* { */) {
      const m = s.match(/^\{(\d+)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        if (!pageToLines.has(currentPage)) pageToLines.set(currentPage, []);
        if (!pageToNodes.has(currentPage)) pageToNodes.set(currentPage, []);
      }
      return;
    }

    if (first === 125 /* } */ || currentPage === 0) return;

    const m = s.match(/^([\[\(\)hvgxk$])(\d+)[:,\.](\d+)(?:[:,\.](\d+))?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+))?/);
    if (m) {
      const tag = parseInt(m[2], 10);
      const line = parseInt(m[3], 10);
      const x = parseInt(m[5], 10);
      const y = parseInt(m[6], 10);
      const w = m[7] !== undefined ? parseInt(m[7], 10) : undefined;
      const h = m[8] !== undefined ? parseInt(m[8], 10) : undefined;

      const node: SyncTeXNode & { page: number } = {
        line,
        tag,
        x,
        y,
        ...(w !== undefined ? { w } : {}),
        ...(h !== undefined ? { h } : {}),
        page: currentPage,
      };

      if (tag === 1 && !lineToPage.has(line)) {
        lineToPage.set(line, currentPage);
      }

      const tagKey = `${tag}:${line}`;
      if (!tagLineToPage.has(tagKey)) {
        tagLineToPage.set(tagKey, currentPage);
      }

      pageToLines.get(currentPage)!.push(line);
      pageToNodes.get(currentPage)!.push(node);

      if (!tagLineToNode.has(tagKey)) {
        tagLineToNode.set(tagKey, node);
      }
    }
  });

  for (const [page, lines] of pageToLines.entries()) {
    pageToLines.set(page, Array.from(new Set(lines)).sort((a, b) => a - b));
  }

  // Pre-sort nodes per page by y-coordinate ascending for O(log N) binary search & branch-and-bound pruning
  for (const [page, nodes] of pageToNodes.entries()) {
    pageToNodes.set(page, nodes.sort((a, b) => a.y - b.y));
  }

  const sortedLines = Array.from(lineToPage.keys()).sort((a, b) => a - b);

  return {
    lineToPage,
    tagLineToPage,
    pageToLines,
    sortedLines,
    pageToNodes,
    tagLineToNode,
    tagToPath,
    pathToTag,
  };
}

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

    // 2. Pre-compile Synchronous Flush: Flush in-flight buffer and dirty files
    if (dirtyFiles.length > 0 || projectId) {
      onPhaseChange?.("flushing");
      try {
        const flushTasks: Promise<any>[] = [];
        if (projectId) {
          flushTasks.push(manuscriptService.updater.flushProject(projectId).catch(() => {}));
        }
        for (const { fileId, content } of dirtyFiles) {
          flushTasks.push(
            flushPageContent(fileId, content).catch((err: unknown) => {
              logger.debug(`[LatexCompilerEngine] Flush notice on ${fileId}`, { error: err });
            }),
          );
        }
        await Promise.allSettled(flushTasks);
      } catch (err: unknown) {
        logger.debug("[LatexCompilerEngine] Flush warning", { error: err });
      }
    }

    // 3. Compile
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

    if (activeTitle && synctexMap.pathToTag) {
      const normalizedTitle = activeTitle.replace(/\\/g, '/').toLowerCase();
      const baseTitle = normalizedTitle.split('/').pop() || normalizedTitle;
      const tag =
        synctexMap.pathToTag.get(baseTitle) ??
        synctexMap.pathToTag.get(normalizedTitle) ??
        synctexMap.pathToTag.get(`./${normalizedTitle}`);
      if (tag !== undefined) {
        const key = `${tag}:${line}`;
        if (synctexMap.tagLineToPage.has(key)) {
          targetPage = synctexMap.tagLineToPage.get(key)!;
          targetNode = synctexMap.tagLineToNode?.get(key) || null;
        }
      }
    }

    if (targetPage === null) {
      targetPage = resolvePageForLine(synctexMap, line);
      if (targetPage !== null) {
        const pNodes = synctexMap.pageToNodes?.get(targetPage);
        targetNode = pNodes?.find((n) => n.line === line) || pNodes?.[0] || null;
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
      const targetY = ptY !== undefined ? ptY * 65536 : clickFraction * 842 * 65536;
      const targetX = ptX !== undefined ? ptX * 65536 : undefined;

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

