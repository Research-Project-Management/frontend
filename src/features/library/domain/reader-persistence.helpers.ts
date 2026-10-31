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
import { isProjectScope } from '@/features/library/domain/item-url';

export { foldDiacritics };

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
  scopeId?: string,
): { label: string; url: string; markdown: string } {
  const authors = paper ? normalizeReaderAuthors(paper.authors, paper.creators) : [];
  const firstAuthor = authors.length > 0 ? getSurnameForCitation(authors[0]!) : 'Unknown';
  const hasMultipleAuthors = authors.length > 1;
  const year = paper?.year && isValidValue(paper.year) ? paper.year : 'n.d.';
  const authorCitation = hasMultipleAuthors ? `${firstAuthor} et al., ${year}` : `${firstAuthor}, ${year}`;
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
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
