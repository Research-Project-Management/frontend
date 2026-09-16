/**
 * viewer.util.ts — PDF Viewer utilities, SyncTeX mapping, and compilation engine
 */

import {
  flushPageContent,
  syncIncremental,
  compileLatex,
  type CompileLatexPayload,
} from "../services/compiler.service";
import { synctexService } from "../services/synctex.service";
import { parseCompileErrors, type ParsedCompileError } from "./editor.util";
import { logger } from "@/shared/lib/utils";

// ── SyncTeX Map & Node Types ──────────────────────────────────────────────────

export interface SyncTeXNode {
  line: number;
  tag: number;
  x: number;
  y: number;
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

  for (const raw of text.split("\n")) {
    const s = raw.trimEnd();
    if (!s) continue;

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
      continue;
    }

    const first = s.charCodeAt(0);

    if (first === 123 /* { */) {
      const m = s.match(/^\{(\d+)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        if (!pageToLines.has(currentPage)) pageToLines.set(currentPage, []);
        if (!pageToNodes.has(currentPage)) pageToNodes.set(currentPage, []);
      }
      continue;
    }

    if (first === 125 /* } */ || currentPage === 0) continue;

    const m = s.match(/^([\[\(\)hvgxk$])(\d+)[:,\.](\d+)(?:[:,\.](\d+))?:(-?\d+),(-?\d+)/);
    if (m) {
      const tag = parseInt(m[2], 10);
      const line = parseInt(m[3], 10);
      const x = parseInt(m[5], 10);
      const y = parseInt(m[6], 10);

      const node: SyncTeXNode & { page: number } = { line, tag, x, y, page: currentPage };

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
  }

  for (const [page, lines] of pageToLines.entries()) {
    pageToLines.set(page, Array.from(new Set(lines)).sort((a, b) => a - b));
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
  draft: boolean;
  useCache: boolean;
  dirtyFiles: DirtyFileItem[];
  onPhaseChange?: (phase: "flushing" | "syncing" | "compiling") => void;
  onThumbnailGenerated?: (base64: string) => void;
}

export type CompileExecutionResult =
  | {
      success: true;
      pdfUrl: string;
      pdfBlob: Blob;
      synctexMap: SyncTeXMap | null;
      logs: string;
      compiledAt: Date;
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    }
  | {
      success: false;
      error: string;
      logs: string;
      errors: ParsedCompileError[];
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    };

// ── Deep Compiler Engine ──────────────────────────────────────────────────────

export const LatexCompilerEngine = {
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

    // Phase 1: Flush dirty files with individual success tracking
    const flushedFileIds: string[] = [];
    const flushErrors: Array<{ fileId: string; error: unknown }> = [];

    if (dirtyFiles.length > 0) {
      onPhaseChange?.("flushing");
      await Promise.all(
        dirtyFiles.map(async ({ fileId, content }) => {
          try {
            await flushPageContent(fileId, content);
            flushedFileIds.push(fileId);
          } catch (err: unknown) {
            logger.warn(`[LatexCompilerEngine] Flush error on ${fileId}`, { error: err });
            flushErrors.push({ fileId, error: err });
          }
        }),
      );
    }

    // Phase 2: Incremental sync
    const dirtyFileIds = flushedFileIds.length > 0 ? flushedFileIds : dirtyFiles.map((f) => f.fileId);
    if (dirtyFileIds.length > 0) {
      onPhaseChange?.("syncing");
      try {
        await syncIncremental(projectId, dirtyFileIds, false);
      } catch (syncErr) {
        logger.warn('[LatexCompilerEngine] Incremental sync error, proceeding to compile', { error: syncErr });
      }
    }

    // Phase 3: Compile
    onPhaseChange?.("compiling");

    const payload: CompileLatexPayload = {
      project_id: projectId || undefined,
      page_id: pageId || undefined,
      main_file: mainFile,
      engine,
      draft,
      use_cache: useCache,
    };

    try {
      const data = await compileLatex(payload);

      if (data?.pdf && typeof data.pdf === "string" && data.pdf.trim().length > 20) {
        const pdfBytes = Uint8Array.from(atob(data.pdf.trim()), (c) => c.charCodeAt(0));
        if (pdfBytes.length > 0) {
          const blob = new Blob([pdfBytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const synctexMap = data.synctex ? parseSyncTeX(data.synctex) : null;

          if (onThumbnailGenerated) {
            generateThumbnail(blob).then((base64) => {
              if (base64) onThumbnailGenerated(base64);
            });
          }

          return {
            success: true,
            pdfUrl: url,
            pdfBlob: blob,
            synctexMap,
            logs: data.logs || "",
            compiledAt: new Date(),
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
        flushedFileIds,
        flushErrors,
      };
    } catch (err: any) {
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
  ): Promise<number | null> {
    try {
      const res = await synctexService.forwardSync({
        projectId,
        file,
        line,
        column,
      });
      return res?.page ?? null;
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
   * SyncTeX forward resolution (Editor line -> PDF page number)
   */
  resolveForward(
    line: number,
    synctexMap: SyncTeXMap | null,
    activeTitle?: string,
    maxPages?: number,
  ): number | null {
    if (!synctexMap) return null;

    let targetPage: number | null = null;

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
        }
      }
    }

    if (targetPage === null) {
      targetPage = synctexMap.lineToPage.get(line) ?? null;
    }

    if (targetPage !== null && targetPage >= 1 && (!maxPages || targetPage <= maxPages)) {
      return targetPage;
    }

    return null;
  },

  /**
   * SyncTeX reverse resolution (PDF double-click -> LaTeX source line and file)
   */
  resolveReverse(
    clickFraction: number,
    pageNum: number,
    synctexMap: SyncTeXMap | null,
  ): { sourcePath: string | null; line: number } | null {
    if (!synctexMap) return null;

    // 1. Direct page node mapping (nearest Y coordinate)
    const nodes = synctexMap.pageToNodes?.get(pageNum);
    if (nodes && nodes.length > 0) {
      const approxY = (1 - clickFraction) * 842 * 65536;
      let bestNode = nodes[0];
      let bestDist = Infinity;

      for (const n of nodes) {
        const dist = Math.abs(n.y - approxY);
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

