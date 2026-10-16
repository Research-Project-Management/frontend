/**
 * reader.util.ts
 *
 * Pure domain & citation utilities for the PDF/EPUB Reader.
 */

import type {
  ReaderAnnotation,
  AnnotationRect,
  ReaderDocument,
  DocumentCreator,
} from '@/features/library/types/reader.types';

export const ANNOTATION_COLORS = {
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    semanticLabel: 'General / Important',
    bg: 'rgba(255, 212, 0, 0.35)',
    border: '#ffd400',
  },
  red: {
    id: 'red',
    name: 'Red',
    semanticLabel: 'Disagreement / Critical Error',
    bg: 'rgba(255, 102, 102, 0.35)',
    border: '#ff6666',
  },
  green: {
    id: 'green',
    name: 'Green',
    semanticLabel: 'Methodology / Supporting Evidence',
    bg: 'rgba(95, 178, 54, 0.35)',
    border: '#5fb236',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    semanticLabel: 'Definition / Background',
    bg: 'rgba(46, 168, 229, 0.35)',
    border: '#2ea8e5',
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    semanticLabel: 'Future Work / Follow-up',
    bg: 'rgba(162, 138, 229, 0.35)',
    border: '#a28ae5',
  },
  magenta: {
    id: 'magenta',
    name: 'Magenta',
    semanticLabel: 'Results / Key Findings',
    bg: 'rgba(229, 110, 238, 0.35)',
    border: '#e56eee',
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    semanticLabel: 'Metrics / Quantitative Data',
    bg: 'rgba(241, 152, 55, 0.35)',
    border: '#f19837',
  },
  gray: {
    id: 'gray',
    name: 'Gray',
    semanticLabel: 'Secondary / Archived',
    bg: 'rgba(170, 170, 170, 0.35)',
    border: '#aaaaaa',
  },
} as const;

export type AnnotationColorId = keyof typeof ANNOTATION_COLORS;

export interface AnnotationFilterCriteria {
  query?: string | null;
  color?: string | null;
  colors?: string[] | null;
  type?: string | null;
  types?: string[] | null;
  tag?: string | null;
  tags?: string[] | null;
  pageRange?: [number, number] | null;
}

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

export const PdfAnnotationEngine = {
  sortAnnotations(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return [...annotations].sort((a, b) => {
      // 1. Canonical spatial sort index (PPPP|YYYYY|XXXXX) from backend SSOT
      if (a.annotationSortIndex && b.annotationSortIndex && a.annotationSortIndex !== b.annotationSortIndex) {
        return a.annotationSortIndex.localeCompare(b.annotationSortIndex);
      }

      // 2. Page index / page number
      const pageA = a.pageIndex ?? (a.pageNumber !== undefined ? a.pageNumber - 1 : 0);
      const pageB = b.pageIndex ?? (b.pageNumber !== undefined ? b.pageNumber - 1 : 0);
      if (pageA !== pageB) return pageA - pageB;

      // 3. Fallback coordinates (normalized 0..1)
      const rectA = (a.rects?.[0] || a.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const rectB = (b.rects?.[0] || b.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const topA = rectA?.y1 ?? rectA?.y ?? 0;
      const topB = rectB?.y1 ?? rectB?.y ?? 0;
      if (Math.abs(topA - topB) > 0.005) return topA - topB;

      const leftA = rectA?.x1 ?? rectA?.x ?? 0;
      const leftB = rectB?.x1 ?? rectB?.x ?? 0;
      if (Math.abs(leftA - leftB) > 0.005) return leftA - leftB;

      // 4. Fallback creation timestamp
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tA - tB;
    });
  },

  sortAnnotationsInReadingOrder(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return this.sortAnnotations(annotations);
  },

  synthesizeMarkdownNote(
    annotations: ReaderAnnotation[],
    paper?: ReaderDocument | null,
    attachmentId?: string,
  ): string {
    const sorted = this.sortAnnotations(annotations);
    const authors = paper ? normalizeReaderAuthors(paper.authors, paper.creators) : [];
    const firstAuthor = authors.length > 0 ? getSurnameForCitation(authors[0]!) : 'Unknown';
    const hasMultipleAuthors = authors.length > 1;
    const year = paper?.year && isValidValue(paper.year) ? paper.year : 'n.d.';
    const authorCitation = hasMultipleAuthors
      ? `${firstAuthor} et al., ${year}`
      : `${firstAuthor}, ${year}`;
    const baseUrl = attachmentId
      ? `flux://open-pdf/library/items/${attachmentId}`
      : `flux://open-pdf/library/items`;

    return sorted
      .map((a) => {
        const pageNum =
          a.pageNumber !== undefined
            ? a.pageNumber
            : a.pageIndex !== undefined
              ? a.pageIndex + 1
              : undefined;
        const pageStr = pageNum ? `, p. ${pageNum}` : '';
        const label = `(${authorCitation}${pageStr})`;
        const pageParam = pageNum ? `page=${pageNum}` : '';
        const annotParam = a.id ? `annotation=${a.id}` : '';
        const qs =
          pageParam && annotParam
            ? `?${pageParam}&${annotParam}`
            : pageParam || annotParam
              ? `?${pageParam || annotParam}`
              : '';
        const markdown = `[${label}](${baseUrl}${qs})`;

        const rawQuote = a.quoteText || a.text || '';
        const quotePart = rawQuote
          ? `> "${rawQuote.trim().replace(/\n+/g, '\n> ')}"`
          : '';
        const citPart = pageNum ? `\n> - ${markdown}` : '';
        const commentPart = a.comment ? `\n\n**Note:** ${a.comment.trim()}` : '';
        return `${quotePart}${citPart}${commentPart}`.trim();
      })
      .filter(Boolean)
      .join('\n\n---\n\n');
  },

  resolveColorId(colorInput?: string | null): AnnotationColorId {
    if (!colorInput) return 'yellow';
    const lower = colorInput.trim().toLowerCase();
    if (lower in ANNOTATION_COLORS) {
      return lower as AnnotationColorId;
    }
    const found = Object.values(ANNOTATION_COLORS).find(
      (c) => c.border.toLowerCase() === lower,
    );
    return found ? found.id : 'yellow';
  },

  getColorSemanticLabel(colorInput?: string | null): string {
    const id = this.resolveColorId(colorInput);
    return ANNOTATION_COLORS[id].semanticLabel;
  },

  filterAnnotations(
    annotations: ReaderAnnotation[],
    queryOrCriteria?: string | AnnotationFilterCriteria | null,
    colorFilter?: string | null,
    options?: {
      type?: string | null;
      types?: string[] | null;
      tags?: string[] | null;
      pageRange?: [number, number] | null;
    },
  ): ReaderAnnotation[] {
    const isCriteriaObject =
      typeof queryOrCriteria === 'object' && queryOrCriteria !== null;

    const q = (
      isCriteriaObject ? queryOrCriteria.query : queryOrCriteria
    )?.trim().toLowerCase() || '';

    const rawColors: string[] = [];
    if (isCriteriaObject) {
      if (queryOrCriteria.color && queryOrCriteria.color !== 'all') {
        rawColors.push(queryOrCriteria.color.trim().toLowerCase());
      }
      if (Array.isArray(queryOrCriteria.colors)) {
        for (const c of queryOrCriteria.colors) {
          if (c && c !== 'all') rawColors.push(c.trim().toLowerCase());
        }
      }
    } else if (colorFilter && colorFilter !== 'all') {
      rawColors.push(colorFilter.trim().toLowerCase());
    }

    const rawTypes: string[] = [];
    if (isCriteriaObject) {
      if (queryOrCriteria.type && queryOrCriteria.type !== 'all') {
        rawTypes.push(queryOrCriteria.type.trim().toLowerCase());
      }
      if (Array.isArray(queryOrCriteria.types)) {
        for (const t of queryOrCriteria.types) {
          if (t && t !== 'all') rawTypes.push(t.trim().toLowerCase());
        }
      }
    } else {
      if (options?.type && options.type !== 'all') {
        rawTypes.push(options.type.trim().toLowerCase());
      }
      if (Array.isArray(options?.types)) {
        for (const t of options.types) {
          if (t && t !== 'all') rawTypes.push(t.trim().toLowerCase());
        }
      }
    }

    const rawTags: string[] = [];
    if (isCriteriaObject) {
      if (queryOrCriteria.tag) rawTags.push(queryOrCriteria.tag.trim().toLowerCase());
      if (Array.isArray(queryOrCriteria.tags)) {
        for (const tg of queryOrCriteria.tags) {
          if (tg) rawTags.push(tg.trim().toLowerCase());
        }
      }
    } else if (Array.isArray(options?.tags)) {
      for (const tg of options.tags) {
        if (tg) rawTags.push(tg.trim().toLowerCase());
      }
    }

    const pageRange = isCriteriaObject ? queryOrCriteria.pageRange : options?.pageRange;

    return annotations.filter((a) => {
      const itemTagNames = Array.isArray((a as Record<string, unknown>).tags)
        ? ((a as Record<string, unknown>).tags as unknown[])
            .map((t) =>
              (typeof t === 'string' ? t : (t as { name?: string })?.name || '')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean)
        : [];

      if (q) {
        const tagText = itemTagNames.join(' ');
        const selectedText = String((a as Record<string, unknown>).selectedText || '').toLowerCase();
        const textMatch =
          (a.quoteText || '').toLowerCase().includes(q) ||
          selectedText.includes(q) ||
          (a.text || '').toLowerCase().includes(q) ||
          (a.comment || '').toLowerCase().includes(q) ||
          tagText.includes(q);
        if (!textMatch) return false;
      }

      if (rawColors.length > 0) {
        const itemColor = (a.color || '#ffd400').toLowerCase();
        const itemColorId = this.resolveColorId(itemColor);
        const matchesColor = rawColors.some((c) => {
          if (c in ANNOTATION_COLORS) {
            const cfg = ANNOTATION_COLORS[c as AnnotationColorId];
            return itemColor === c || itemColor === cfg.border.toLowerCase() || itemColorId === c;
          }
          return itemColor === c || itemColorId === this.resolveColorId(c);
        });
        if (!matchesColor) return false;
      }

      if (rawTypes.length > 0) {
        const itemType = (a.type || 'highlight').toLowerCase();
        const matchesType = rawTypes.some((t) => itemType === t);
        if (!matchesType) return false;
      }

      if (rawTags.length > 0) {
        const matchesAllTags = rawTags.every((reqTag) =>
          itemTagNames.some((t) => t === reqTag || t.includes(reqTag)),
        );
        if (!matchesAllTags) return false;
      }

      if (pageRange && pageRange.length === 2) {
        const pageNum = a.pageNumber ?? (a.pageIndex !== undefined ? a.pageIndex + 1 : 1);
        if (pageNum < pageRange[0] || pageNum > pageRange[1]) return false;
      }

      return true;
    });
  },

  normalizeRect(
    rect: AnnotationRect | { x: number; y: number; width: number; height: number },
  ): AnnotationRect {
    const r = rect as {
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    const startX = r.x1 ?? r.x ?? 0;
    const startY = r.y1 ?? r.y ?? 0;
    const endX = r.x2 !== undefined ? r.x2 : r.width !== undefined ? startX + r.width : startX;
    const endY = r.y2 !== undefined ? r.y2 : r.height !== undefined ? startY + r.height : startY;

    // Support inverted drag coordinates (bottom-right to top-left) by ordering min/max before clamping
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const x1 = Math.max(0, Math.min(1, minX));
    const y1 = Math.max(0, Math.min(1, minY));
    const x2 = Math.max(x1, Math.min(1, maxX));
    const y2 = Math.max(y1, Math.min(1, maxY));
    const width = x2 - x1;
    const height = y2 - y1;

    return {
      x1,
      y1,
      x2,
      y2,
      width,
      height,
    };
  },

  /**
   * Clamps percentage-based `[0, 100]` or custom bounds `[0, maxBound]` area/image selection rectangles,
   * supporting inverted drag coordinates so out-of-bounds drags never break rendering.
   */
  clampAreaSelectionBounds(
    rect: { x1?: number; y1?: number; x2?: number; y2?: number; x?: number; y?: number; width?: number; height?: number },
    maxBound = 100,
  ): AnnotationRect {
    const startX = rect.x1 ?? rect.x ?? 0;
    const startY = rect.y1 ?? rect.y ?? 0;
    const endX = rect.x2 !== undefined ? rect.x2 : rect.width !== undefined ? startX + rect.width : startX;
    const endY = rect.y2 !== undefined ? rect.y2 : rect.height !== undefined ? startY + rect.height : startY;

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const x1 = Math.max(0, Math.min(maxBound, minX));
    const y1 = Math.max(0, Math.min(maxBound, minY));
    const x2 = Math.max(x1, Math.min(maxBound, maxX));
    const y2 = Math.max(y1, Math.min(maxBound, maxY));
    return {
      x1,
      y1,
      x2,
      y2,
      width: x2 - x1,
      height: y2 - y1,
    };
  },

  denormalizeRect(
    rect: AnnotationRect | { x: number; y: number; width: number; height: number },
    pageWidth: number,
    pageHeight: number,
  ): { x: number; y: number; width: number; height: number; x1: number; y1: number; x2: number; y2: number } {
    const norm = this.normalizeRect(rect);
    const w = Math.max(0, pageWidth);
    const h = Math.max(0, pageHeight);
    return {
      x: norm.x1 * w,
      y: norm.y1 * h,
      width: (norm.width ?? norm.x2 - norm.x1) * w,
      height: (norm.height ?? norm.y2 - norm.y1) * h,
      x1: norm.x1 * w,
      y1: norm.y1 * h,
      x2: norm.x2 * w,
      y2: norm.y2 * h,
    };
  },

  getColorConfig(colorId?: string): { bg: string; border: string; semanticLabel: string } {
    if (colorId && colorId in ANNOTATION_COLORS) {
      const c = ANNOTATION_COLORS[colorId as AnnotationColorId];
      return { bg: c.bg, border: c.border, semanticLabel: c.semanticLabel };
    }
    if (colorId) {
      const found = Object.values(ANNOTATION_COLORS).find(
        (c) => c.border.toLowerCase() === colorId.toLowerCase(),
      );
      if (found) return { bg: found.bg, border: found.border, semanticLabel: found.semanticLabel };
    }
    return {
      bg: ANNOTATION_COLORS.yellow.bg,
      border: ANNOTATION_COLORS.yellow.border,
      semanticLabel: ANNOTATION_COLORS.yellow.semanticLabel,
    };
  },
};

import { parseCreatorName, splitAuthorString } from '@/features/library/domain/creators';
import { isValidValue, stripLatexMarkup } from '@/features/library/domain/metadata';

function normalizeReaderAuthors(
  rawAuthors?: unknown,
  creators?: DocumentCreator[] | null,
): string[] {
  if (Array.isArray(creators) && creators.length > 0) {
    const list: string[] = [];
    for (const c of creators) {
      if (!c) continue;
      if (c.lastName && isValidValue(c.lastName)) {
        const first = c.firstName && isValidValue(c.firstName) ? c.firstName.trim() : '';
        list.push(first ? `${c.lastName.trim()}, ${first}` : c.lastName.trim());
        continue;
      }
      const fullName = (c.fullName || c.name || '').trim();
      if (fullName && isValidValue(fullName)) {
        list.push(stripLatexMarkup(fullName));
      } else {
        const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
        if (full && isValidValue(full)) list.push(stripLatexMarkup(full));
      }
    }
    if (list.length > 0) return list;
  }

  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const result: string[] = [];
    for (const item of rawAuthors) {
      if (!item || !isValidValue(item)) continue;
      if (typeof item === 'string') {
        result.push(...splitAuthorString(item));
      } else if (typeof item === 'object') {
        const authorObj = item as {
          fullName?: string;
          name?: string;
          firstName?: string;
          given?: string;
          lastName?: string;
          family?: string;
        };
        const last = (authorObj.lastName || authorObj.family || '').trim();
        const first = (authorObj.firstName || authorObj.given || '').trim();
        if (last && isValidValue(last)) {
          result.push(first && isValidValue(first) ? `${last}, ${first}` : last);
        } else {
          const fullName = (authorObj.fullName || authorObj.name || '').trim();
          if (fullName && isValidValue(fullName)) {
            result.push(stripLatexMarkup(fullName));
          }
        }
      }
    }
    return result;
  }

  if (typeof rawAuthors === 'string' && isValidValue(rawAuthors)) {
    return splitAuthorString(rawAuthors);
  }

  return [];
}

function getSurnameForCitation(rawAuthor: string): string {
  const parsed = parseCreatorName(rawAuthor);
  return parsed.lastName || parsed.fullName || 'Unknown';
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'to', 'from',
]);

export function generateReaderCitationKey(
  paper?: Partial<ReaderDocument> | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && isValidValue(paper.citationKey)) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeReaderAuthors(paper.authors, paper.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const parsed = parseCreatorName(authors[0]!);
    authorPart = (parsed.lastName || parsed.fullName || 'author')
      .replace(/[Đđ]/g, 'd')
      .replace(/[Łł]/g, 'l')
      .replace(/[Øø]/g, 'o')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  authorPart = authorPart.replace(/[^a-z0-9]/gi, '');

  const yearPart = paper.year && isValidValue(paper.year) ? String(paper.year) : '';

  let titlePart = '';
  if (paper.title && isValidValue(paper.title)) {
    const cleanTitle = stripLatexMarkup(paper.title)
      .replace(/[Đđ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const word of cleanTitle.trim().split(/\s+/)) {
      const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean && !STOPWORDS.has(clean)) {
        titlePart = clean;
        break;
      }
    }
  }

  const baseKey = `${authorPart || 'ref'}${yearPart}${titlePart || 'paper'}`;
  if (!existingKeys) return baseKey;

  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  if (!keySet.has(baseKey)) return baseKey;

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < letters.length; i++) {
    const candidate = `${baseKey}${letters[i]}`;
    if (!keySet.has(candidate)) return candidate;
  }
  let counter = 2;
  while (keySet.has(`${baseKey}_${counter}`)) {
    counter++;
  }
  return `${baseKey}_${counter}`;
}

export function formatInTextCitation(paper: ReaderDocument, pageNumber?: number): string {
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
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
  return `(${authorStr}, ${yearStr}${pageStr})`;
}

export function formatAnnotationCitation(
  paper?: ReaderDocument | null,
  attachmentId?: string,
  pageNumber?: number,
  annotationId?: string,
): { label: string; url: string; markdown: string } {
  const authors = paper ? normalizeReaderAuthors(paper.authors, paper.creators) : [];
  const firstAuthor = authors.length > 0 ? getSurnameForCitation(authors[0]!) : 'Unknown';
  const hasMultipleAuthors = authors.length > 1;
  const year = paper?.year && isValidValue(paper.year) ? paper.year : 'n.d.';
  const authorCitation = hasMultipleAuthors ? `${firstAuthor} et al., ${year}` : `${firstAuthor}, ${year}`;
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
  const label = `(${authorCitation}${pageStr})`;

  const pageParam = pageNumber ? `page=${pageNumber}` : '';
  const annotParam = annotationId ? `annotation=${annotationId}` : '';
  const queryStr = [pageParam, annotParam].filter(Boolean).join('&');
  const qs = queryStr ? `?${queryStr}` : '';

  const url = attachmentId
    ? `flux://open-pdf/library/items/${attachmentId}${qs}`
    : `flux://open-pdf/library/items${qs}`;

  const markdown = `[${label}](${url})`;

  return { label, url, markdown };
}

function foldDiacritics(input: string): string {
  return input
    .replace(/[Đđ]/g, (m) => (m === 'Đ' ? 'D' : 'd'))
    .replace(/[Łł]/g, (m) => (m === 'Ł' ? 'L' : 'l'))
    .replace(/[Øø]/g, (m) => (m === 'Ø' ? 'O' : 'o'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Searches extracted PDF pages (`{ pageNumber, text }`) with diacritic & case insensitivity,
 * returning ordered `PdfTextMatch` items with surrounding snippet context.
 */
export function searchPdfPages(
  pages: ReadonlyArray<{ pageNumber: number; text: string }>,
  query?: string | null,
  snippetRadius = 35,
): PdfTextMatch[] {
  if (!query || typeof query !== 'string') return [];
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const foldedQuery = foldDiacritics(cleanQuery);
  if (!foldedQuery) return [];

  const matches: PdfTextMatch[] = [];
  let matchIndex = 0;

  for (const page of pages) {
    if (!page.text) continue;
    const rawText = page.text;
    const foldedText = foldDiacritics(rawText);

    let searchPos = 0;
    while (searchPos <= foldedText.length - foldedQuery.length) {
      const idx = foldedText.indexOf(foldedQuery, searchPos);
      if (idx === -1) break;

      const matchedText = rawText.slice(idx, idx + cleanQuery.length);
      const snippetStart = Math.max(0, idx - snippetRadius);
      const snippetEnd = Math.min(rawText.length, idx + cleanQuery.length + snippetRadius);
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

      searchPos = idx + Math.max(1, foldedQuery.length);
    }
  }

  return matches;
}

/**
 * Cycles the active match index (`'next'` or `'prev'`) with wrap-around
 * (`Next` on the last match wraps to index `0`; `Prev` on index `0` wraps to `matches.length - 1`)
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

export interface PdfOutlineNode {
  title: string;
  pageNumber: number;
  items?: PdfOutlineNode[];
  children?: PdfOutlineNode[];
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

