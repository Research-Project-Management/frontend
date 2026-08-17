/**
 * viewer.util.ts — PDF Viewer utilities, SyncTeX mapping, and compilation engine
 */

import {
  flushPageContent,
  syncIncremental,
  compileLatex,
  type CompileLatexPayload,
  fetchLookupDoi,
  fetchSearchCrossref,
  type CrossrefWork,
} from "../services/document.service";
import { parseCompileErrors, type ParsedCompileError } from "./editor.util";

export type { CrossrefWork };

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

    const m = s.match(/^([\[\(\)hvgxk$])(\d+):(\d+),(\d+):(-?\d+),(-?\d+)/);
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
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdf = await loadingTask.promise;
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
    }
  | {
      success: false;
      error: string;
      logs: string;
      errors: ParsedCompileError[];
    };

// ── Deep Compiler Engine ──────────────────────────────────────────────────────

export const LatexCompilerEngine = {
  async compile(opts: CompileExecutionOptions): Promise<CompileExecutionResult> {
    const {
      projectId,
      mainFile,
      engine,
      draft,
      useCache,
      dirtyFiles,
      onPhaseChange,
      onThumbnailGenerated,
    } = opts;

    // Phase 1: Flush dirty files
    if (dirtyFiles.length > 0) {
      onPhaseChange?.("flushing");
      try {
        await Promise.all(
          dirtyFiles.map(({ fileId, content }) =>
            flushPageContent(fileId, content).catch((err) => {
              console.warn(`[LatexCompilerEngine] Flush error on ${fileId}:`, err);
            }),
          ),
        );
      } catch (err) {
        console.warn("[LatexCompilerEngine] Some file flushes failed, proceeding:", err);
      }
    }

    // Phase 2: Incremental sync
    const dirtyFileIds = dirtyFiles.map((f) => f.fileId);
    if (dirtyFileIds.length > 0) {
      onPhaseChange?.("syncing");
      try {
        await syncIncremental(projectId, dirtyFileIds, false);
      } catch (syncErr) {
        console.warn("[LatexCompilerEngine] Incremental sync error, proceeding to compile:", syncErr);
      }
    }

    // Phase 3: Compile
    onPhaseChange?.("compiling");

    const payload: CompileLatexPayload = {
      project_id: projectId,
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
      };
    } catch (err: any) {
      const errStr = err instanceof Error ? err.message : String(err);
      const parsedErrors = parseCompileErrors(errStr);

      return {
        success: false,
        error: errStr,
        logs: errStr,
        errors: parsedErrors,
      };
    }
  },

  async forceSync(projectId: string): Promise<{ synced: string[] }> {
    return await syncIncremental(projectId, [], true);
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

// ── Client PDF Metadata Parser ────────────────────────────────────────────────

export type PdfMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pageCount?: number;
  keywords?: string;
  doi?: string;
  journal?: string;
  publisher?: string;
  issn?: string;
  isbn?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publicationDate?: string;
  abstract?: string;
  language?: string;
  copyright?: string;
  year?: number | string;
  authors?: string[];
  editors?: string[];
  type?: string;
  itemType?: string;
  url?: string;
  crossrefEnriched?: boolean;
  extraFields?: Record<string, string>;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  publicationTitle?: string;
  place?: string;
  keywordsList?: string[];
};

const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/[^\s<>"{}|\\^`[\]]+)/g;

export function extractDoiFromText(text: string): string | null {
  const matches = text.match(DOI_REGEX);
  if (!matches || !matches[0]) return null;
  let doi = matches[0].trim();
  doi = doi.replace(/[.,;:!?\s]+$/, "");

  if (doi.endsWith(")")) {
    const openCount = (doi.match(/\(/g) || []).length;
    const closeCount = (doi.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      doi = doi.slice(0, -1);
    }
  }

  return doi.startsWith("10.") ? doi : null;
}

export function parseXmpMetadata(xmpXml: string): Partial<PdfMetadata> {
  const result: Partial<PdfMetadata> = {};
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmpXml, "application/xml");

    const getTagText = (tag: string): string | undefined => {
      const el = doc.getElementsByTagName(tag)[0];
      return el?.textContent?.trim() || undefined;
    };

    const getSeqItems = (parentTag: string): string[] => {
      const parent = doc.getElementsByTagName(parentTag)[0];
      if (!parent) return [];
      const seq = parent.getElementsByTagName("rdf:Seq")[0] || parent.getElementsByTagName("Seq")[0];
      if (!seq) return [];
      const lis = seq.getElementsByTagName("rdf:li") || seq.getElementsByTagName("li");
      const items: string[] = [];
      for (let i = 0; i < lis.length; i++) {
        const text = lis[i].textContent?.trim();
        if (text) items.push(text);
      }
      return items;
    };

    const dcDoi = getTagText("dc:identifier");
    if (dcDoi && extractDoiFromText(dcDoi)) {
      result.doi = extractDoiFromText(dcDoi)!;
    } else {
      const prismDoi = getTagText("prism:doi");
      if (prismDoi) result.doi = extractDoiFromText(prismDoi) || prismDoi;
    }

    const titleAlt = doc.getElementsByTagName("dc:title")[0];
    if (titleAlt) {
      const li = titleAlt.getElementsByTagName("rdf:li")[0] || titleAlt.getElementsByTagName("li")[0];
      if (li?.textContent) result.title = li.textContent.trim();
    }

    const authors = getSeqItems("dc:creator");
    if (authors.length > 0) {
      result.authors = authors;
      result.author = authors.join(", ");
    }

    const description = getTagText("dc:description");
    if (description) result.abstract = description;

    const publisher = getTagText("dc:publisher");
    if (publisher) result.publisher = publisher;

    const journal = getTagText("prism:publicationName") || getTagText("prism:journalName");
    if (journal) result.journal = journal;

    const volume = getTagText("prism:volume");
    if (volume) result.volume = volume;

    const issue = getTagText("prism:number") || getTagText("prism:issue");
    if (issue) result.issue = issue;

    const pageRange = getTagText("prism:pageRange");
    if (pageRange) result.pages = pageRange;

    const prismDate = getTagText("prism:coverDate") || getTagText("prism:publicationDate") || getTagText("dc:date");
    if (prismDate) {
      result.publicationDate = prismDate;
      const yearMatch = prismDate.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch) result.year = yearMatch[1];
    }
  } catch (err) {
    console.warn("Failed to parse XMP metadata:", err);
  }
  return result;
}

export function parsePdfDate(pdfDateStr?: string): string | undefined {
  if (!pdfDateStr) return undefined;
  const match = pdfDateStr.match(/^D:(\d{4})(\d{2})?(\d{2})?/);
  if (match) {
    const year = match[1];
    const month = match[2] || "01";
    const day = match[3] || "01";
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

export function mergeCrossrefMetadata(
  meta: PdfMetadata,
  crossref: CrossrefWork,
): PdfMetadata {
  const merged: PdfMetadata = { ...meta, crossrefEnriched: true };

  if (crossref.title) {
    merged.title = crossref.title;
  }

  if (crossref.authors && crossref.authors.length > 0) {
    merged.authors = crossref.authors;
    merged.author = crossref.authors.join(", ");
  }

  if (crossref.journal) {
    merged.journal = crossref.journal;
    merged.publicationTitle = crossref.journal;
  }

  if (crossref.journalAbbr) {
    merged.journalAbbr = crossref.journalAbbr;
  }

  if (crossref.publisher) merged.publisher = crossref.publisher;
  if (crossref.volume) merged.volume = crossref.volume;
  if (crossref.issue) merged.issue = crossref.issue;
  if (crossref.pages) merged.pages = crossref.pages;
  if (crossref.issn) merged.issn = crossref.issn;
  if (crossref.isbn) merged.isbn = crossref.isbn;
  if (crossref.abstract) merged.abstract = crossref.abstract;
  if (crossref.url) merged.url = crossref.url;
  if (crossref.year) merged.year = crossref.year;
  if (crossref.publicationDate) merged.publicationDate = crossref.publicationDate;
  if (crossref.type) merged.itemType = crossref.type;

  return merged;
}

export async function extractPdfMetadataFromFile(file: File): Promise<PdfMetadata> {
  const meta: PdfMetadata = {};

  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;

    meta.pageCount = pdfDoc.numPages;

    const metadataObj = await pdfDoc.getMetadata().catch(() => null);

    if (metadataObj) {
      const info: any = metadataObj.info || {};

      if (info.Title) meta.title = info.Title;
      if (info.Author) {
        meta.author = info.Author;
        meta.authors = [info.Author];
      }
      if (info.Subject) meta.subject = info.Subject;
      if (info.Creator) meta.creator = info.Creator;
      if (info.Producer) meta.producer = info.Producer;
      if (info.Keywords) meta.keywords = info.Keywords;
      if (info.CreationDate) {
        meta.creationDate = parsePdfDate(info.CreationDate);
        if (meta.creationDate) {
          meta.year = meta.creationDate.split("-")[0];
          meta.publicationDate = meta.creationDate;
        }
      }
      if (info.ModDate) meta.modDate = parsePdfDate(info.ModDate);

      if (metadataObj.metadata) {
        try {
          const rawXml = (metadataObj.metadata as any).getRaw?.() || "";
          if (rawXml) {
            const xmpMeta = parseXmpMetadata(rawXml);
            Object.assign(meta, xmpMeta);
          }
        } catch (e) {
          console.warn("Failed to get raw XMP from pdfjs metadata object:", e);
        }
      }
    }

    if (!meta.doi) {
      const pagesToScan = Math.min(2, pdfDoc.numPages);
      for (let i = 1; i <= pagesToScan; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const fullText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");

        const foundDoi = extractDoiFromText(fullText);
        if (foundDoi) {
          meta.doi = foundDoi;
          break;
        }
      }
    }

    if (meta.doi) {
      try {
        const res = await fetchLookupDoi(meta.doi);
        if (res && res.work) {
          return mergeCrossrefMetadata(meta, res.work);
        }
      } catch (err) {
        console.warn("Crossref DOI enrichment failed:", err);
      }
    }

    if (!meta.title || !meta.author) {
      const titleToSearch = meta.title || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      if (titleToSearch && titleToSearch.length > 5) {
        try {
          const res = await fetchSearchCrossref(titleToSearch);
          if (res && res.works && res.works.length > 0) {
            return mergeCrossrefMetadata(meta, res.works[0]);
          }
        } catch (err) {
          console.warn("Crossref title search enrichment failed:", err);
        }
      }
    }

    return meta;
  } catch (err) {
    console.error("PDF metadata extraction error:", err);
    return meta;
  }
}
