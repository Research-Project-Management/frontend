/**
 * reader-search-outline.ts
 *
 * Extracted viewport math, citation formatting, fulltext search, outline filtering,
 * and local preference persistence helpers for the PDF/EPUB Reader.
 */

import type {
  ReaderDocument,
  DocumentCreator,
  PdfOutlineItem,
} from '@/features/library/domain/types/reader.schema';
import { normalizeAuthors, parseCreatorName } from '@/features/library/domain/creators';
import { isValidValue } from '@/features/library/domain/metadata-mapper';
import { foldDiacritics } from '@/features/library/domain/citations';
import { isProjectScope } from '@/features/library/domain/identifiers';

export { foldDiacritics };

// ── PDF Viewport Math and Geometric Calculations ────────────────────────────

export interface ViewportParams {
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  fitMode?: 'fit-width' | 'fit-page' | 'page-width' | 'page-fit' | 'auto' | 'custom';
  viewMode?: 'continuous' | 'single' | 'spread';
}

const ISO_A4_ASPECT_RATIO = Math.SQRT2;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function calculateEffectiveViewportDimensions(params: ViewportParams): {
  effectivePageWidth: number;
  scale: number;
} {
  const { containerWidth, containerHeight, fitMode, viewMode } = params;
  if (viewMode === 'spread') {
    return {
      effectivePageWidth: Math.round((containerWidth - 32) / 2),
      scale: 1.0,
    };
  }

  if (fitMode === 'fit-page' || fitMode === 'page-fit') {
    return {
      effectivePageWidth: Math.round((containerHeight - 72) / ISO_A4_ASPECT_RATIO),
      scale: 1.0,
    };
  }

  return {
    effectivePageWidth: containerWidth - 16,
    scale: 1.0,
  };
}

export function computeEffectivePdfPageWidth(params: ViewportParams): number {
  const {
    containerWidth,
    containerHeight,
    zoom = 1.0,
    fitMode = 'fit-width',
    viewMode = 'continuous',
  } = params;
  const clampedZoom = Math.min(5.0, Math.max(0.25, zoom));

  if (viewMode === 'spread') {
    const availableSpreadWidth = Math.max(520, containerWidth - 32);
    return Math.max(260, Math.round((availableSpreadWidth / 2) * clampedZoom));
  }
  if (fitMode === 'fit-page' || fitMode === 'page-fit') {
    const containerH = containerHeight || 800;
    return Math.max(260, Math.round(((containerH - 72) / ISO_A4_ASPECT_RATIO) * clampedZoom));
  }
  if (fitMode === 'auto') {
    const availableWidth = Math.max(320, containerWidth - 32);
    return Math.max(320, Math.round(Math.min(availableWidth, 920) * clampedZoom));
  }
  return Math.max(320, Math.round(containerWidth * clampedZoom));
}

export function computeSpreadPairs(
  totalPages: number,
  spreadMode: 'odd' | 'even' = 'odd',
): Array<[number, number | null]> {
  if (totalPages <= 0) return [];
  if (spreadMode === 'even') {
    const pairs: Array<[number, number | null]> = [[1, null]];
    for (let p = 2; p <= totalPages; p += 2) {
      pairs.push([p, p + 1 <= totalPages ? p + 1 : null]);
    }
    return pairs;
  }
  return Array.from({ length: Math.ceil(totalPages / 2) }, (_, i) => {
    const p = 2 * i + 1;
    return [p, p + 1 <= totalPages ? p + 1 : null];
  });
}

export function buildClientAnnotationSortIndex(
  pageIndex: number,
  y = 0,
  x = 0,
): string {
  const clampPad = (val: number, digits: number): string => {
    const safe = Number.isFinite(val) ? Math.max(0, Math.round(val)) : 0;
    const maxVal = Math.pow(10, digits) - 1;
    return String(Math.min(maxVal, safe)).padStart(digits, '0');
  };
  const scaleCoord = (coord: number): number => {
    if (!Number.isFinite(coord) || coord < 0) return 0;
    return coord <= 1.0001 ? Math.round(coord * 10000) : Math.round(coord * 100);
  };
  return `${clampPad(pageIndex, 5)}|${clampPad(scaleCoord(y), 6)}|${clampPad(scaleCoord(x), 5)}`;
}

export function isPageInVirtualWindow(params: {
  pageNum: number;
  visiblePage: number;
  totalPages: number;
  viewMode?: string;
  pinnedPage?: number;
}): boolean {
  const { pageNum, visiblePage, pinnedPage } = params;
  if (pinnedPage !== undefined && pageNum === pinnedPage) return true;
  return Math.abs(pageNum - visiblePage) <= 2;
}

export function calculatePageAspectRatio(
  dims: { width: number; height: number },
  rotation = 0,
): number {
  const isRotated = (rotation / 90) % 2 !== 0;
  const w = isRotated ? dims.height : dims.width;
  const h = isRotated ? dims.width : dims.height;
  return h / Math.max(1, w);
}

export function normalizeRectCoordinates(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pageWidth: number,
  pageHeight: number,
): { x1: number; y1: number; width: number; height: number } | null {
  if (pageWidth <= 0 || pageHeight <= 0) return null;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    x1: round4(left / pageWidth),
    y1: round4(top / pageHeight),
    width: round4(width / pageWidth),
    height: round4(height / pageHeight),
  };
}

export function cropCanvasSelectionToDataUrl(
  canvas: HTMLCanvasElement | null | undefined,
  rectNorm: { x1: number; y1: number; width?: number; height?: number; x2?: number; y2?: number },
  maxDim = 560,
  quality = 0.78,
): string | undefined {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0 || typeof document === 'undefined') {
    return undefined;
  }
  try {
    const normW = rectNorm.width ?? (rectNorm.x2 !== undefined ? rectNorm.x2 - rectNorm.x1 : 0.1);
    const normH = rectNorm.height ?? (rectNorm.y2 !== undefined ? rectNorm.y2 - rectNorm.y1 : 0.1);
    const sx = Math.round(rectNorm.x1 * canvas.width);
    const sy = Math.round(rectNorm.y1 * canvas.height);
    const sw = Math.max(1, Math.round(normW * canvas.width));
    const sh = Math.max(1, Math.round(normH * canvas.height));
    const cropCanvas = document.createElement('canvas');
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    cropCanvas.width = Math.max(1, Math.round(sw * scale));
    cropCanvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
    let dataUrl = cropCanvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = cropCanvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > 180_000) {
      dataUrl = cropCanvas.toDataURL('image/jpeg', Math.max(0.5, quality - 0.18));
    }
    cropCanvas.width = 0;
    cropCanvas.height = 0;
    return dataUrl.length <= 180_000 ? dataUrl : undefined;
  } catch {
    return undefined;
  }
}

// ── Fulltext Search, Outline Filtering & Citation Helpers ───────────────────

export interface PdfTextMatch {
  matchIndex: number;
  pageNumber: number;
  matchedText: string;
  snippet: string;
  charOffset: number;
}

export interface PdfSearchCycleResult {
  activeMatchIndex: number;
  displayPosition: string;
  targetPageNumber: number | null;
  activeMatch: PdfTextMatch | null;
}

export interface PdfOutlineNode {
  title: string;
  pageNumber: number;
  items?: PdfOutlineNode[];
  children?: PdfOutlineNode[];
}

export interface FlattenedOutlineSection {
  id: string;
  num: string;
  title: string;
  page?: number;
  level: number;
  hasChildren: boolean;
  parentId: string | null;
}

export function buildOutlineSections(
  fulltextSections?: ReadonlyArray<{ id?: string; num?: string; title: string; page?: number }> | null,
  pdfOutline?: ReadonlyArray<PdfOutlineNode> | null,
  outlineFilter = '',
): FlattenedOutlineSection[] {
  if (fulltextSections && fulltextSections.length > 0) {
    const raw = fulltextSections.map((s, idx) => ({
      id: s.id || `sec-${idx}-${s.num || ''}-${s.page || 1}`,
      num: s.num || '',
      title: s.title,
      page: s.page,
      level: s.num ? Math.min(4, s.num.split('.').filter(Boolean).length) : 1,
    }));
    return raw.map((item, idx) => {
      const next = raw[idx + 1];
      const hasChildren = Boolean(next && next.level > item.level);
      let parentId: string | null = null;
      for (let j = idx - 1; j >= 0; j--) {
        if (raw[j]!.level < item.level) {
          parentId = raw[j]!.id;
          break;
        }
      }
      return { ...item, hasChildren, parentId };
    });
  }

  if (pdfOutline && pdfOutline.length > 0) {
    const flattened: FlattenedOutlineSection[] = [];
    const walk = (
      items: ReadonlyArray<PdfOutlineNode>,
      level: number,
      parentId: string | null,
    ) => {
      items.forEach((item, idx) => {
        const id = `${parentId || 'root'}-${level}-${idx}-${item.pageNumber}`;
        const childItems = item.items ?? item.children;
        const hasChildren = Boolean(childItems && childItems.length > 0);
        flattened.push({
          id,
          num: '',
          title: item.title,
          page: item.pageNumber,
          level: Math.min(4, level),
          hasChildren,
          parentId,
        });
        if (hasChildren && childItems) {
          walk(childItems, level + 1, id);
        }
      });
    };
    const filteredTree = outlineFilter.trim()
      ? filterPdfOutlineTree(pdfOutline, outlineFilter)
      : pdfOutline;
    walk(filteredTree, 1, null);
    return flattened;
  }

  return [];
}

export function filterVisibleOutlineSections(
  sections: ReadonlyArray<FlattenedOutlineSection>,
  outlineFilter: string,
  hasFulltextSections: boolean,
  collapsedOutlineIds: ReadonlySet<string>,
): FlattenedOutlineSection[] {
  const isSearching = Boolean(outlineFilter.trim());
  if (isSearching) {
    if (!hasFulltextSections) return [...sections];
    const q = outlineFilter.toLowerCase().trim();
    return sections.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.num && s.num.toLowerCase().includes(q)),
    );
  }
  if (collapsedOutlineIds.size === 0) return [...sections];
  const byId = new Map(sections.map((s) => [s.id, s]));
  return sections.filter((s) => {
    let currParent = s.parentId;
    while (currParent) {
      if (collapsedOutlineIds.has(currParent)) return false;
      currParent = byId.get(currParent)?.parentId ?? null;
    }
    return true;
  });
}

export function resolveActiveOutlineSectionId(
  filteredSections: ReadonlyArray<FlattenedOutlineSection>,
  selectedOutlineId: string | null,
  currentPage: number,
): string | null {
  if (filteredSections.length === 0) return null;
  if (selectedOutlineId) {
    const selected = filteredSections.find((s) => s.id === selectedOutlineId);
    if (selected && selected.page === currentPage) {
      return selected.id;
    }
  }
  const exactMatch = filteredSections.find((s) => s.page === currentPage);
  if (exactMatch) return exactMatch.id;
  let bestPreceding: FlattenedOutlineSection | null = null;
  for (const s of filteredSections) {
    if (s.page && s.page <= currentPage) {
      bestPreceding = s;
    }
  }
  return bestPreceding?.id ?? null;
}

export function normalizeReaderAuthors(
  rawAuthors?: unknown,
  creators?: DocumentCreator[] | null,
): string[] {
  if (Array.isArray(creators) && creators.length > 0) {
    const fromCreators = normalizeAuthors(undefined, creators);
    if (fromCreators.length > 0) return fromCreators;
  }
  return normalizeAuthors(rawAuthors, creators);
}

export function getSurnameForCitation(rawAuthor: string): string {
  const parsed = parseCreatorName(rawAuthor);
  return parsed.lastName || parsed.fullName || 'Unknown';
}

export function formatInTextCitation(
  paper: ReaderDocument,
  pageNumber?: number,
  pageLabel?: string | null,
): string {
  const authors = normalizeReaderAuthors(paper.authors, paper.creators);
  let authorStr = 'Unknown';
  if (authors.length === 1) {
    authorStr = getSurnameForCitation(authors[0]!);
  } else if (authors.length === 2) {
    const s1 = getSurnameForCitation(authors[0]!);
    const s2 = getSurnameForCitation(authors[1]!);
    authorStr = `${s1} & ${s2}`;
  } else if (authors.length > 2) {
    const s1 = getSurnameForCitation(authors[0]!);
    authorStr = `${s1} et al.`;
  }
  const yearStr = paper.year && isValidValue(paper.year) ? String(paper.year) : 'n.d.';
  const displayPage = pageLabel && pageLabel.trim() ? pageLabel.trim() : pageNumber ? String(pageNumber) : '';
  const pageStr = displayPage ? `, p. ${displayPage}` : '';
  return `(${authorStr}, ${yearStr}${pageStr})`;
}

export function formatAnnotationCitation(
  paper?: ReaderDocument | null,
  attachmentId?: string,
  pageNumber?: number,
  annotationId?: string,
  scopeId?: string,
  pageLabel?: string | null,
): { label: string; url: string; markdown: string } {
  const authors = paper ? normalizeReaderAuthors(paper.authors, paper.creators) : [];
  const firstAuthor = authors.length > 0 ? getSurnameForCitation(authors[0]!) : 'Unknown';
  const hasMultipleAuthors = authors.length > 1;
  const year = paper?.year && isValidValue(paper.year) ? paper.year : 'n.d.';
  const authorCitation = hasMultipleAuthors ? `${firstAuthor} et al., ${year}` : `${firstAuthor}, ${year}`;
  const displayPage = pageLabel && pageLabel.trim() ? pageLabel.trim() : pageNumber ? String(pageNumber) : '';
  const pageStr = displayPage ? `, p. ${displayPage}` : '';
  const label = `(${authorCitation}${pageStr})`;

  const itemId = paper?.id;
  const effectiveProjectId = isProjectScope(scopeId)
    ? scopeId
    : paper?.projectId && isProjectScope(String(paper.projectId))
      ? String(paper.projectId)
      : undefined;
  const attParam = attachmentId ? `attachmentId=${encodeURIComponent(attachmentId)}` : '';
  const pageParam = pageNumber ? `page=${pageNumber}` : '';
  const annotParam = annotationId ? `annotation=${encodeURIComponent(annotationId)}` : '';
  const queryStr = [attParam, pageParam, annotParam].filter(Boolean).join('&');
  const qs = queryStr ? `?${queryStr}` : '';

  const basePath = effectiveProjectId
    ? `/projects/${encodeURIComponent(effectiveProjectId)}/library/papers`
    : `/library/papers`;
  const url = itemId
    ? `${basePath}/${encodeURIComponent(itemId)}${qs}`
    : `${basePath}${qs}`;

  const markdown = `[${label}](${url})`;

  return { label, url, markdown };
}

const FOLDED_PAGE_TEXT_CACHE = new WeakMap<
  { pageNumber: number; text: string },
  { rawText: string; foldedText: string }
>();

export interface SearchPdfPagesOptions {
  snippetRadius?: number;
  matchCase?: boolean;
  wholeWords?: boolean;
}

function isWordBoundaryChar(ch?: string): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}_]/u.test(ch);
}

/**
 * Searches extracted PDF pages (`{ pageNumber, text }`) with configurable diacritic,
 * case sensitivity, and whole-word matching, returning ordered `PdfTextMatch` items.
 */
export function searchPdfPages(
  pages: ReadonlyArray<{ pageNumber: number; text: string }>,
  query?: string | null,
  snippetRadiusOrOptions: number | SearchPdfPagesOptions = 35,
): PdfTextMatch[] {
  if (!query || typeof query !== 'string') return [];
  const cleanQuery = query.trim().normalize('NFC');
  if (!cleanQuery) return [];

  const opts: SearchPdfPagesOptions =
    typeof snippetRadiusOrOptions === 'number'
      ? { snippetRadius: snippetRadiusOrOptions }
      : snippetRadiusOrOptions;
  const snippetRadius = opts.snippetRadius ?? 35;
  const matchCase = Boolean(opts.matchCase);
  const wholeWords = Boolean(opts.wholeWords);

  const targetQuery = matchCase ? cleanQuery : foldDiacritics(cleanQuery);
  if (!targetQuery) return [];

  const matches: PdfTextMatch[] = [];
  let matchIndex = 0;

  for (const page of pages) {
    if (!page.text) continue;
    let cached = FOLDED_PAGE_TEXT_CACHE.get(page);
    if (!cached) {
      const rawText = page.text.normalize('NFC');
      cached = {
        rawText,
        foldedText: foldDiacritics(rawText),
      };
      FOLDED_PAGE_TEXT_CACHE.set(page, cached);
    }
    const { rawText, foldedText } = cached;
    const targetHaystack = matchCase ? rawText : foldedText;

    let searchPos = 0;
    while (searchPos <= targetHaystack.length - targetQuery.length) {
      const idx = targetHaystack.indexOf(targetQuery, searchPos);
      if (idx === -1) break;

      const matchEnd = idx + targetQuery.length;
      if (wholeWords) {
        const charBefore = idx > 0 ? rawText[idx - 1] : undefined;
        const charAfter = matchEnd < rawText.length ? rawText[matchEnd] : undefined;
        if (isWordBoundaryChar(charBefore) || isWordBoundaryChar(charAfter)) {
          searchPos = idx + 1;
          continue;
        }
      }

      const matchedText = rawText.slice(idx, matchEnd);
      const snippetStart = Math.max(0, idx - snippetRadius);
      const snippetEnd = Math.min(rawText.length, matchEnd + snippetRadius);
      const prefix = snippetStart > 0 ? '...' : '';
      const suffix = snippetEnd < rawText.length ? '...' : '';
      const snippet = `${prefix}${rawText.slice(snippetStart, snippetEnd).trim()}${suffix}`;

      matches.push({
        matchIndex: matchIndex++,
        pageNumber: page.pageNumber,
        matchedText,
        snippet,
        charOffset: idx,
      });

      searchPos = idx + Math.max(1, targetQuery.length);
    }
  }

  return matches;
}

/**
 * Cycles the active match index (`'next'` or `'prev'`) with wrap-around
 * and resolves the 1-based display string (`"3 of 14"`) and target `pageNumber`.
 */
export function cyclePdfSearchMatch(
  matches: ReadonlyArray<PdfTextMatch>,
  currentIndex: number,
  direction: 'next' | 'prev',
): PdfSearchCycleResult {
  const total = matches.length;
  if (total === 0) {
    return {
      activeMatchIndex: -1,
      displayPosition: '0 of 0',
      targetPageNumber: null,
      activeMatch: null,
    };
  }

  const normalizedCurrent = ((currentIndex % total) + total) % total;
  const nextIndex =
    direction === 'next'
      ? (normalizedCurrent + 1) % total
      : (normalizedCurrent - 1 + total) % total;

  const activeMatch = matches[nextIndex] ?? null;
  return {
    activeMatchIndex: nextIndex,
    displayPosition: `${nextIndex + 1} of ${total}`,
    targetPageNumber: activeMatch ? activeMatch.pageNumber : null,
    activeMatch,
  };
}

/**
 * Filters a nested PDF Document Outline tree (`PdfOutlineNode[]`) by keyword,
 * preserving parent ancestor branches whenever a nested child/grandchild chapter matches.
 */
export function filterPdfOutlineTree(
  nodes: ReadonlyArray<PdfOutlineNode>,
  query?: string | null,
): PdfOutlineNode[] {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [...nodes];
  }
  const foldedQuery = foldDiacritics(query.trim());

  const filterRecursive = (list: ReadonlyArray<PdfOutlineNode>): PdfOutlineNode[] => {
    const out: PdfOutlineNode[] = [];
    for (const node of list) {
      const childList = node.items ?? node.children ?? [];
      const filteredChildren = childList.length > 0 ? filterRecursive(childList) : [];
      const selfMatches = foldDiacritics(node.title || '').includes(foldedQuery);

      if (selfMatches || filteredChildren.length > 0) {
        const cloned: PdfOutlineNode = {
          ...node,
          ...(node.items !== undefined
            ? { items: selfMatches && filteredChildren.length === 0 ? node.items : filteredChildren }
            : {}),
          ...(node.children !== undefined
            ? { children: selfMatches && filteredChildren.length === 0 ? node.children : filteredChildren }
            : {}),
        };
        out.push(cloned);
      }
    }
    return out;
  };

  return filterRecursive(nodes);
}

export interface ReaderPreferenceStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Pure port-based preference reader/writer for Reader viewport & persistence state.
 */
export function readReaderPreference<T>(
  key: string,
  fallback: T,
  storage?: ReaderPreferenceStoragePort | null,
): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeReaderPreference<T>(
  key: string,
  value: T,
  storage?: ReaderPreferenceStoragePort | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export interface PdfOutlineProxyDoc {
  getOutline?: () => Promise<
    Array<{
      title?: string;
      dest?: string | Array<unknown> | null;
      items?: Array<unknown>;
    }> | null
  >;
  getDestination?: (dest: string) => Promise<Array<unknown> | null>;
  getPageIndex?: (ref: unknown) => Promise<number>;
}

/**
 * Extracts and resolves a nested PDF outline tree with 1-based page numbers from a PDF.js document proxy.
 */
export async function resolvePdfOutlineFromDoc(
  outlineDoc: PdfOutlineProxyDoc,
): Promise<PdfOutlineItem[]> {
  if (typeof outlineDoc.getOutline !== 'function') return [];
  const rawOutline = await outlineDoc.getOutline();
  if (!Array.isArray(rawOutline) || rawOutline.length === 0) return [];

  const resolvePageNum = async (
    dest: string | Array<unknown> | null | undefined,
  ): Promise<number> => {
    if (!dest) return 1;
    try {
      const destArray =
        typeof dest === 'string'
          ? typeof outlineDoc.getDestination === 'function'
            ? await outlineDoc.getDestination(dest)
            : null
          : Array.isArray(dest)
            ? dest
            : null;
      if (!destArray || destArray.length === 0) return 1;
      const pageRef = destArray[0];
      if (typeof pageRef === 'number') {
        return Math.max(1, pageRef + 1);
      }
      if (pageRef && typeof outlineDoc.getPageIndex === 'function') {
        const idx = await outlineDoc.getPageIndex(pageRef);
        return Math.max(1, idx + 1);
      }
    } catch {
      // Ignore destination resolution error
    }
    return 1;
  };

  const mapNodes = async (
    nodes: Array<{
      title?: string;
      dest?: string | Array<unknown> | null;
      items?: Array<unknown>;
    }>,
  ): Promise<PdfOutlineItem[]> => {
    const results = await Promise.all(
      nodes.map(async (node): Promise<PdfOutlineItem | null> => {
        const title = (node.title || '').trim();
        if (!title) return null;
        const [pageNumber, children] = await Promise.all([
          resolvePageNum(node.dest),
          Array.isArray(node.items) && node.items.length > 0
            ? mapNodes(
                node.items as Array<{
                  title?: string;
                  dest?: string | Array<unknown> | null;
                  items?: Array<unknown>;
                }>,
              )
            : Promise.resolve(undefined),
        ]);
        return {
          title,
          pageNumber,
          dest: node.dest,
          items: children,
        };
      }),
    );
    return results.filter((item): item is PdfOutlineItem => item !== null);
  };

  return mapNodes(rawOutline);
}
