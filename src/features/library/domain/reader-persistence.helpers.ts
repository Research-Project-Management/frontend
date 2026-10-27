/**
 * reader-persistence.helpers.ts
 *
 * Extracted citation formatting, fulltext search, outline filtering,
 * and local preference persistence helpers for the PDF/EPUB Reader.
 */

import type {
  ReaderDocument,
  DocumentCreator,
} from '@/features/library/domain/types/reader.types';
import { normalizeAuthors, parseCreatorName } from '@/features/library/domain/creators';
import { isValidValue, stripLatexMarkup } from '@/features/library/domain/metadata';
import { foldDiacritics } from '@/features/library/domain/academic-text';
import {
  generateCitationKey,
  toAsciiKeyPart,
} from '@/features/library/domain/citations';

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

export function generateReaderCitationKey(
  paper?: Partial<ReaderDocument> | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && isValidValue(paper.citationKey)) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }
  const hasAnyBibliographicField = Boolean(
    (Array.isArray(paper.authors) && paper.authors.length > 0) ||
      (Array.isArray(paper.creators) && paper.creators.length > 0) ||
      (paper.year && isValidValue(paper.year)) ||
      (paper.title && isValidValue(paper.title)),
  );
  if (!hasAnyBibliographicField) {
    return 'refpaper';
  }
  const generated = generateCitationKey(
    {
      ...paper,
      authors: normalizeReaderAuthors(paper.authors, paper.creators),
      title:
        paper.title && isValidValue(paper.title) ? paper.title : 'paper',
    },
    existingKeys,
  );
  return generated === 'ref' ? 'refpaper' : generated;
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

const FOLDED_PAGE_TEXT_CACHE = new WeakMap<
  { pageNumber: number; text: string },
  { rawText: string; foldedText: string }
>();

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
  const cleanQuery = query.trim().normalize('NFC');
  if (!cleanQuery) return [];

  const foldedQuery = foldDiacritics(cleanQuery);
  if (!foldedQuery) return [];

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

    let searchPos = 0;
    while (searchPos <= foldedText.length - foldedQuery.length) {
      const idx = foldedText.indexOf(foldedQuery, searchPos);
      if (idx === -1) break;

      const matchedText = rawText.slice(idx, idx + foldedQuery.length);
      const snippetStart = Math.max(0, idx - snippetRadius);
      const snippetEnd = Math.min(rawText.length, idx + foldedQuery.length + snippetRadius);
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
