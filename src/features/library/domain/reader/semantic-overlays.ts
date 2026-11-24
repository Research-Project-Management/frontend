/**
 * Semantic PDF Overlays Domain
 *
 * Mirrors Zotero Reader's pre-computed per-page semantic overlay architecture:
 * - Pass 1 (`pdf-link`): resolves native PDF /Link rectangles against the document's references, figures, tables, and sections.
 * - Pass 2 (`matched`): groups PDF TextItems into visual column lines/paragraphs and extracts exact canonical [0..1] rects for unlinked or multi-line citations.
 * - Hit testing translates pointer viewport coordinates back to canonical 0-degree space.
 */

import type { DocumentFulltext } from '@/features/library/types/reader.types';
import {
  measureProportionalSubstringRatios,
  normalizePageRotation,
  rotatePointToCanonical,
  rotateRectFromCanonical,
  rotateRectToCanonical,
  type PdfLinkRectGeometry,
  type PdfPageHoverGeometry,
  type PdfTextTokenGeometry,
} from './annotation-geometry';

/**
 * Matches author-year in-text citations across APA, ICLR, NeurIPS, and parenthetical styles
 * (e.g., `Deng et al., 2013`, `Hinton & Salakhutdinov, 2006`, `Hinton et al., 2012a`,
 * `Kingma and Ba (2015)`, `He et al., 2016`, `Tu, 2014`).
 */
export const AUTHOR_YEAR_CITATION_RE =
  /\b([A-ZÀ-Ỹ][A-Za-zÀ-ỹ'\-]{1,24})(?:\s+(?:&|and)\s+([A-ZÀ-Ỹ][A-Za-zÀ-ỹ'\-]{1,24})|\s+et\s+al\.?)?(?:\s*,\s*|\s+)\(?((?:19|20)\d{2}[a-z]?)\b\)?/gu;

const BRACKET_CITATION_RE = /\[(\d{1,3}(?:\s*[,;–\-—]\s*\d{1,3})*)\]/g;
const FIGURE_CITATION_RE = /\b(?:Fig\.?|Figure)\s*(\d+[A-Za-z]?)\b/gi;
const TABLE_CITATION_RE = /\b(?:Table|Tab\.?)\s*(\d+[A-Za-z]?)\b/gi;

export interface NormalizedPdfRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  height?: number;
}

export interface SemanticOverlayEntry {
  badge: string;
  title?: string;
  authors?: string;
  venueYear?: string;
  rawFallback?: string;
  rawCitation?: string;
  subtitle?: string;
  snippet?: string;
  targetPage?: number;
  targetYRatio?: number;
  externalUrl?: string;
  referenceIndex?: number;
}

export interface SemanticPageOverlay {
  id: string;
  type: 'citation' | 'internal-link';
  source: 'pdf-link' | 'matched';
  pageNumber: number;
  rects: NormalizedPdfRect[];
  kind: 'Reference' | 'Figure' | 'Table' | 'Section';
  entries: SemanticOverlayEntry[];
  matchedText?: string;
}

export type DocumentReferenceItem = NonNullable<DocumentFulltext['references']>[number];
export type DocumentFigureItem = NonNullable<DocumentFulltext['figures']>[number];
export type DocumentTableItem = NonNullable<DocumentFulltext['tables']>[number];
export type DocumentSectionItem = NonNullable<DocumentFulltext['sections']>[number];

export interface IndexedReferenceEntry {
  index: number;
  ref: DocumentReferenceItem;
  year?: number;
  lowerAuthors: string[];
  lowerCitation: string;
  targetPage?: number;
}

export interface SemanticLookupIndex {
  referencesByNumber: Map<number, IndexedReferenceEntry>;
  referencesByYear: Map<number, IndexedReferenceEntry[]>;
  indexedReferences: IndexedReferenceEntry[];
  figuresByNumber: Map<string, DocumentFigureItem>;
  figureList: Array<{ fig: DocumentFigureItem; lowerLabel: string }>;
  tablesByNumber: Map<string, DocumentTableItem>;
  tableList: Array<{ tbl: DocumentTableItem; lowerLabel: string }>;
  sectionsByNumber: Map<string, DocumentSectionItem>;
  sectionList: DocumentSectionItem[];
  fallbackRefPage?: number;
  bibliographyStartPage?: number;
  bibliographyEndPage?: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Number(clamp01(value).toFixed(4));
}

function toNormalizedPdfRect(x1: number, y1: number, x2: number, y2: number): NormalizedPdfRect {
  const nx1 = round4(Math.min(x1, x2));
  const ny1 = round4(Math.min(y1, y2));
  const nx2 = round4(Math.max(x1, x2));
  const ny2 = round4(Math.max(y1, y2));
  return {
    x1: nx1,
    y1: ny1,
    x2: nx2,
    y2: ny2,
    width: round4(Math.max(0, nx2 - nx1)),
    height: round4(Math.max(0, ny2 - ny1)),
  };
}

export function cleanRawCitation(raw: string, refNum?: string | number): string {
  let cleaned = raw.replace(/\s+/g, ' ').replace(/\s+([,.;:?!])/g, '$1').trim();
  if (refNum !== undefined) {
    const escaped = String(refNum).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`^(?:\\[${escaped}\\]|${escaped}\\.)\\s*`), '');
  } else {
    cleaned = cleaned.replace(/^(?:\[\d{1,3}\]|\d{1,3}\.)\s*/, '');
  }
  return cleaned.trim();
}

export function formatAuthorsSummary(authors?: string[]): string {
  if (!Array.isArray(authors) || authors.length === 0) return '';
  return authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' et al.' : '');
}

export function parseBracketCitationIndices(inner: string): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  const parts = inner.split(/[,;]/);
  for (const part of parts) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^(\d{1,3})\s*[-–—]\s*(\d{1,3})$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]!, 10);
      const end = parseInt(rangeMatch[2]!, 10);
      if (start >= 1 && end >= start && end - start <= 12) {
        for (let n = start; n <= end; n++) {
          if (!seen.has(n)) {
            seen.add(n);
            result.push(n);
            if (result.length >= 6) return result;
          }
        }
      }
      continue;
    }
    const singleMatch = trimmed.match(/^(\d{1,3})$/);
    if (singleMatch) {
      const n = parseInt(singleMatch[1]!, 10);
      if (n >= 1 && !seen.has(n)) {
        seen.add(n);
        result.push(n);
        if (result.length >= 6) return result;
      }
    }
  }
  return result;
}

export function buildReferenceOverlayEntry(
  badge: string,
  indexed: IndexedReferenceEntry,
  stripNumberPrefix?: number,
  fallbackText?: string,
): SemanticOverlayEntry {
  const { ref, targetPage, index } = indexed;
  const rawCitationText = ref.rawCitation
    ? cleanRawCitation(ref.rawCitation, stripNumberPrefix)
    : '';
  const cleanTitle = ref.title?.trim();
  const authors = formatAuthorsSummary(ref.authors);
  const venueYear = [ref.journal, ref.year ? String(ref.year) : ''].filter(Boolean).join(', ');

  if (rawCitationText) {
    return {
      badge,
      title: cleanTitle || rawCitationText,
      authors: authors || undefined,
      venueYear: venueYear || undefined,
      subtitle: venueYear || undefined,
      rawCitation: rawCitationText,
      rawFallback: rawCitationText,
      targetPage,
      referenceIndex: index,
    };
  }

  const hasStructured = Boolean(cleanTitle || authors || venueYear);
  return {
    badge,
    title: cleanTitle || undefined,
    authors: authors || undefined,
    venueYear: venueYear || undefined,
    subtitle: venueYear || undefined,
    rawFallback: hasStructured
      ? undefined
      : fallbackText || (stripNumberPrefix ? `Reference #${stripNumberPrefix}` : badge),
    targetPage,
    referenceIndex: index,
  };
}

/**
 * Checks whether a dot-space boundary belongs to an author initial or bibliographic
 * abbreviation rather than ending the leading author segment.
 */
function isNonBreakingCitationPeriod(prefixEndingWithDot: string): boolean {
  if (/(?:^|[\s,.\-(])\p{Lu}\.$/u.test(prefixEndingWithDot)) {
    return true;
  }
  if (/(?:^|[\s,(])[a-z]\.[a-z]\.$/i.test(prefixEndingWithDot)) {
    return true;
  }
  return /\b(?:Jr|Sr|Dr|Prof|No|Vol|pp|ed|eds|proc|conf|int|natl|acad|sci|univ|trans|fig|eq|st)$/i.test(
    prefixEndingWithDot.slice(0, -1),
  );
}

function findAuthorSegmentEndIndex(text: string): number {
  const dotSpaceRe = /\.\s+/g;
  for (const match of text.matchAll(dotSpaceRe)) {
    const dotIdx = match.index;
    if (dotIdx === undefined || dotIdx <= 3) continue;
    const prefix = text.slice(0, dotIdx + 1);
    if (!isNonBreakingCitationPeriod(prefix)) {
      return dotIdx;
    }
  }
  return -1;
}

/**
 * Fallback bibliography extractor for pre-extracted documents whose `fulltext.references`
 * is empty or collapsed into a single mashed string while `fulltext.pages` (or `plainText`)
 * contains the bibliography section.
 */
export function extractFallbackReferencesFromPages(
  pages?: Array<{ pageNumber?: number; text?: string }>,
  plainText?: string,
  sections?: DocumentSectionItem[],
): Array<DocumentReferenceItem & { pageNumber?: number }> {
  let sourceText = '';
  const pageSpans: Array<{ pageNumber: number; start: number; end: number }> = [];

  if (Array.isArray(pages) && pages.length > 0) {
    const parts: string[] = [];
    let cursor = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p || typeof p.text !== 'string') continue;
      const chunk = p.text;
      const start = cursor;
      parts.push(chunk);
      cursor += chunk.length + 1;
      pageSpans.push({
        pageNumber: typeof p.pageNumber === 'number' && p.pageNumber >= 1 ? p.pageNumber : i + 1,
        start,
        end: start + chunk.length,
      });
    }
    sourceText = parts.join('\n').normalize('NFKC');
  }

  if (sourceText.trim().length < 20 && typeof plainText === 'string' && plainText.trim().length >= 20) {
    sourceText = plainText.normalize('NFKC');
    pageSpans.length = 0;
  }

  let fallbackSectionPage: number | undefined;
  const headingPattern =
    /(?:^|\n)[^\S\r\n]*(?:(?:\d+(?:\.\d+)*\.?|[IVX]+\.?)\s+)?(?:r\s*eferences|b\s*ibliography|literature\s+cited|works\s+cited|tài\s+liệu\s+tham\s+khảo)\b([^\r\n]*)/gi;

  const findHeadingBodyStart = (text: string): number => {
    let best = -1;
    for (const match of text.matchAll(headingPattern)) {
      const idx = match.index ?? -1;
      if (idx === -1) continue;
      const trailing = (match[1] || '').trim();
      if (trailing !== '' && trailing !== ':') continue;
      const afterHeadingIdx = idx + match[0].length;
      const previewAfter = text.slice(afterHeadingIdx, afterHeadingIdx + 80);
      if (/^(?:\r?\n)?\s*(?:[.\u2026·]{2,}\s*\d+|\d{1,4}\s*(?:\r?\n|$))/.test(previewAfter)) {
        continue;
      }
      best = afterHeadingIdx;
    }
    return best;
  };

  let refBodyStart = sourceText.trim().length >= 20 ? findHeadingBodyStart(sourceText) : -1;

  if (refBodyStart === -1 && Array.isArray(sections) && sections.length > 0) {
    const refSec = sections.find((s) =>
      /\b(?:r\s*eferences|b\s*ibliography|literature\s+cited|works\s+cited)\b/i.test(s.title || ''),
    );
    if (refSec && Array.isArray(refSec.paragraphs) && refSec.paragraphs.length > 0) {
      sourceText = refSec.paragraphs.join('\n').normalize('NFKC');
      refBodyStart = 0;
      pageSpans.length = 0;
      fallbackSectionPage = refSec.page >= 1 ? refSec.page : undefined;
    }
  }

  if (refBodyStart === -1) return [];

  let refSection = sourceText.slice(refBodyStart);
  const stopMatch = refSection.match(
    /\n[^\S\r\n]*(?:(?:appendix|appendices|supplementary\s+material|acknowledg(?:e)?ments?|author\s+contributions?|competing\s+interests?|phụ\s+lục|lời\s+cảm\s+ơn)\b|[A-ZÀ-Ỹ]\.\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ\s]{3,50})\s*(?:\r?\n|$)/iu,
  );
  if (stopMatch && stopMatch.index !== undefined && stopMatch.index > 60) {
    refSection = refSection.slice(0, stopMatch.index);
  }

  const lines = refSection
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l || !/^(?:page\s+)?\d+(?:\s+of\s+\d+)?$/i.test(l));

  const numberedStartRe = /^(?:\[\d{1,4}\]|\d{1,4}\.(?=\s+[A-Z"\u201C]))\s*/;
  const authorYearStartRe =
    /^[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'\-]{1,24},\s+(?:[A-ZÀ-Ỹ]\.(?:\s*[A-ZÀ-Ỹ]\.)*|[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'\-]{1,24}\b)/;
  const hasNumberedEntries = lines.filter((l) => numberedStartRe.test(l)).length >= 2;

  const rawEntries: string[] = [];
  let currentEntry = '';

  for (const line of lines) {
    if (!line) {
      if (!hasNumberedEntries && currentEntry.trim().length > 15) {
        rawEntries.push(currentEntry.trim());
        currentEntry = '';
      }
      continue;
    }
    if (hasNumberedEntries) {
      if (numberedStartRe.test(line)) {
        if (currentEntry.trim().length > 12) rawEntries.push(currentEntry.trim());
        currentEntry = line;
      } else if (currentEntry) {
        currentEntry = currentEntry.endsWith('-')
          ? `${currentEntry.slice(0, -1)}${line}`
          : `${currentEntry} ${line}`;
      }
    } else if (
      authorYearStartRe.test(line) &&
      currentEntry.trim().length > 25 &&
      (/\b(?:19\d{2}|20[0-2]\d)[a-z]?\b/.test(currentEntry) ||
        /[.!?)]\s*$/.test(currentEntry.trim()))
    ) {
      rawEntries.push(currentEntry.trim());
      currentEntry = line;
    } else {
      currentEntry = currentEntry
        ? currentEntry.endsWith('-')
          ? `${currentEntry.slice(0, -1)}${line}`
          : `${currentEntry} ${line}`
        : line;
    }
  }
  if (currentEntry.trim().length > 12) {
    rawEntries.push(currentEntry.trim());
  }

  const results: Array<DocumentReferenceItem & { pageNumber?: number }> = [];
  const maxEntries = 250;
  let pageSearchCursor = refBodyStart;

  for (let i = 0; i < Math.min(rawEntries.length, maxEntries); i++) {
    const raw = rawEntries[i]!.replace(/\s+/g, ' ').trim();
    if (raw.length < 15) continue;

    let entryPage = fallbackSectionPage;
    if (pageSpans.length > 0) {
      const snippet = raw.slice(0, Math.min(36, raw.length));
      const foundPos = sourceText.indexOf(snippet, pageSearchCursor);
      if (foundPos !== -1) {
        pageSearchCursor = foundPos + snippet.length;
        const ownerSpan = pageSpans.find((sp) => foundPos >= sp.start && foundPos <= sp.end);
        if (ownerSpan) entryPage = ownerSpan.pageNumber;
      } else if (!entryPage) {
        const refOwner = pageSpans.find(
          (sp) => refBodyStart >= sp.start && refBodyStart <= sp.end,
        );
        if (refOwner) entryPage = refOwner.pageNumber;
      }
    }

    const bodyWithoutMarker = raw.replace(numberedStartRe, '').trim();
    const yearMatch = bodyWithoutMarker.match(/\b(19\d{2}|20[0-2]\d)[a-z]?\b/);
    const year = yearMatch?.[1] ? parseInt(yearMatch[1], 10) : undefined;

    let title: string | undefined;
    const quotedTitleMatch = bodyWithoutMarker.match(
      /[""\u201C]([^""\u201D]{8,250})[""\u201D]/,
    );
    if (quotedTitleMatch?.[1]) {
      title = quotedTitleMatch[1].replace(/[.,;]+$/, '').trim();
    } else {
      const afterYearDot = bodyWithoutMarker.match(
        /\(\s*(?:19\d{2}|20[0-2]\d)[a-z]?\s*\)\.\s+([^.]{10,250})\./,
      );
      if (afterYearDot?.[1]) {
        title = afterYearDot[1].trim();
      }
    }

    const authors: string[] = [];
    const authorYearParenIdx = bodyWithoutMarker.search(/\(\s*(?:19\d{2}|20[0-2]\d)/);
    const firstSentenceEndIdx = findAuthorSegmentEndIndex(bodyWithoutMarker);
    const authorPrefixEnd = quotedTitleMatch?.index
      ? quotedTitleMatch.index
      : authorYearParenIdx > 3
        ? authorYearParenIdx
        : firstSentenceEndIdx;

    if (authorPrefixEnd > 3) {
      const rawAuthorSegment = bodyWithoutMarker
        .slice(0, authorPrefixEnd)
        .replace(/\bet\s+al\.?/gi, '')
        .replace(/\band\b/gi, ',')
        .replace(/&/g, ',')
        .replace(/[.;:\s]+$/, '')
        .trim();
      if (rawAuthorSegment.length >= 3 && rawAuthorSegment.length <= 240) {
        for (const token of rawAuthorSegment.split(/[,;]+/)) {
          const cleaned = token.replace(/\s+/g, ' ').trim();
          if (cleaned.length >= 2 && !/^\d+$/.test(cleaned)) {
            authors.push(cleaned);
          }
        }
      }
    }

    results.push({
      id: `fallback-ref-${i + 1}`,
      title,
      authors: authors.slice(0, 12),
      year,
      rawCitation: raw,
      ...(entryPage ? { pageNumber: entryPage } : {}),
    });
  }

  return results;
}

/**
 * Builds the lookup index used both to pre-compute per-page semantic overlays
 * and to resolve citations on hover.
 */
export function buildSemanticLookupIndex(
  fulltext?: DocumentFulltext | null,
  numPages = 0,
): SemanticLookupIndex {
  const figuresByNumber = new Map<string, DocumentFigureItem>();
  const figureList: Array<{ fig: DocumentFigureItem; lowerLabel: string }> = [];
  if (Array.isArray(fulltext?.figures)) {
    for (const f of fulltext.figures) {
      const lowerId = f.id?.toLowerCase();
      if (lowerId) {
        figuresByNumber.set(lowerId, f);
        if (lowerId.startsWith('fig-')) figuresByNumber.set(lowerId.slice(4), f);
      }
      const lowerLabel = f.label?.toLowerCase() || '';
      const labelNumMatch = lowerLabel.match(/\b(?:fig\.?|figure)\s*(\d+[a-z]?)\b/i);
      if (labelNumMatch?.[1]) figuresByNumber.set(labelNumMatch[1].toLowerCase(), f);
      figureList.push({ fig: f, lowerLabel });
    }
  }

  const tablesByNumber = new Map<string, DocumentTableItem>();
  const tableList: Array<{ tbl: DocumentTableItem; lowerLabel: string }> = [];
  if (Array.isArray(fulltext?.tables)) {
    for (const t of fulltext.tables) {
      const lowerId = t.id?.toLowerCase();
      if (lowerId) {
        tablesByNumber.set(lowerId, t);
        if (lowerId.startsWith('table-')) tablesByNumber.set(lowerId.slice(6), t);
      }
      const lowerLabel = t.label?.toLowerCase() || '';
      const labelNumMatch = lowerLabel.match(/\b(?:table|tab\.?)\s*(\d+[a-z]?)\b/i);
      if (labelNumMatch?.[1]) tablesByNumber.set(labelNumMatch[1].toLowerCase(), t);
      tableList.push({ tbl: t, lowerLabel });
    }
  }

  const sectionsByNumber = new Map<string, DocumentSectionItem>();
  const sectionList: DocumentSectionItem[] = [];
  if (Array.isArray(fulltext?.sections)) {
    for (const s of fulltext.sections) {
      sectionList.push(s);
      const rawNum = s.num?.trim().replace(/\.+$/, '');
      if (rawNum) {
        sectionsByNumber.set(rawNum.toLowerCase(), s);
      } else {
        const titlePrefix = s.title?.trim().match(/^(\d+(?:\.\d+)*)\b/);
        if (titlePrefix?.[1]) {
          sectionsByNumber.set(titlePrefix[1].toLowerCase(), s);
        }
      }
    }
  }

  let bibliographyStartPage: number | undefined;
  if (sectionList.length > 0) {
    const refSec = sectionList.find((s) =>
      /\b(?:r\s*eferences|b\s*ibliography|works\s+cited|literature\s+cited)\b/i.test(s.title || ''),
    );
    if (refSec?.page && refSec.page >= 1) bibliographyStartPage = refSec.page;
  }
  if (!bibliographyStartPage && Array.isArray(fulltext?.pages)) {
    for (let i = fulltext.pages.length - 1; i >= 0; i--) {
      const p = fulltext.pages[i];
      if (
        p &&
        p.pageNumber >= 1 &&
        /(?:^|\n)\s*(?:(?:\d+(?:\.\d+)*\.?|[IVX]+\.?)\s+)?(?:r\s*eferences|b\s*ibliography|works\s+cited)\s*(?:\n|$)/i.test(
          p.text || '',
        )
      ) {
        bibliographyStartPage = p.pageNumber;
      }
    }
  }
  const fallbackRefPage = bibliographyStartPage ?? (numPages > 0 ? numPages : undefined);
  let bibliographyEndPage: number | undefined;
  if (bibliographyStartPage !== undefined && sectionList.length > 0) {
    for (const s of sectionList) {
      if (
        s.page &&
        s.page > bibliographyStartPage &&
        /\b(?:appendix|appendices|supplementary|supplemental)\b/i.test(s.title || '')
      ) {
        bibliographyEndPage =
          bibliographyEndPage === undefined ? s.page : Math.min(bibliographyEndPage, s.page);
      }
    }
  }

  const indexedReferences: IndexedReferenceEntry[] = [];
  const referencesByNumber = new Map<number, IndexedReferenceEntry>();
  const referencesByYear = new Map<number, IndexedReferenceEntry[]>();

  const rawRefs = Array.isArray(fulltext?.references) ? fulltext.references : [];
  const hasMashedReference = rawRefs.some((r) => (r.rawCitation?.length ?? 0) > 600);
  const shouldTryFallback =
    rawRefs.length === 0 || rawRefs.length < 3 || hasMashedReference;

  let effectiveReferences: Array<
    DocumentReferenceItem & { page?: number; pageNumber?: number; pageIndex?: number }
  > = rawRefs;

  if (shouldTryFallback) {
    const fallbackRefs = extractFallbackReferencesFromPages(
      fulltext?.pages,
      fulltext?.plainText,
      sectionList,
    );
    if (
      fallbackRefs.length > rawRefs.length ||
      (hasMashedReference && fallbackRefs.length > 0)
    ) {
      effectiveReferences = fallbackRefs;
    }
  }

  if (effectiveReferences.length > 0) {
    effectiveReferences.forEach((r, idx) => {
      const explicitPage =
        r.pageNumber ?? r.page ?? (typeof r.pageIndex === 'number' ? r.pageIndex + 1 : undefined);
      const entry: IndexedReferenceEntry = {
        index: idx + 1,
        ref: r,
        year: r.year,
        lowerAuthors: Array.isArray(r.authors) ? r.authors.map((a) => a.toLowerCase()) : [],
        lowerCitation: r.rawCitation ? r.rawCitation.toLowerCase() : '',
        targetPage: explicitPage && explicitPage >= 1 ? explicitPage : fallbackRefPage,
      };
      indexedReferences.push(entry);

      if (!referencesByNumber.has(idx + 1)) {
        referencesByNumber.set(idx + 1, entry);
      }
      if (r.rawCitation) {
        const leadingNumMatch = r.rawCitation.trim().match(/^(?:\[(\d{1,3})\]|(\d{1,3})\.)\s+/);
        const explicitNumStr = leadingNumMatch?.[1] ?? leadingNumMatch?.[2];
        if (explicitNumStr) {
          const explicitNum = parseInt(explicitNumStr, 10);
          if (explicitNum >= 1) {
            referencesByNumber.set(explicitNum, entry);
          }
        }
      }

      if (typeof entry.year === 'number') {
        const list = referencesByYear.get(entry.year);
        if (list) list.push(entry);
        else referencesByYear.set(entry.year, [entry]);
      }
    });
  }

  return {
    referencesByNumber,
    referencesByYear,
    indexedReferences,
    figuresByNumber,
    figureList,
    tablesByNumber,
    tableList,
    sectionsByNumber,
    sectionList,
    fallbackRefPage,
    bibliographyStartPage,
    bibliographyEndPage,
  };
}

function resolveAuthorYearMatch(
  match: RegExpExecArray,
  lookup: SemanticLookupIndex,
): SemanticOverlayEntry | null {
  if (lookup.indexedReferences.length === 0) return null;
  const surname = match[1]!.toLowerCase();
  const coAuthorSurname = match[2]?.toLowerCase();
  const yearToken = match[3]!.toLowerCase();
  const yearNum = parseInt(yearToken.slice(0, 4), 10);
  const yearStr = String(yearNum);
  const matchedCandidates = lookup.referencesByYear.get(yearNum) ?? lookup.indexedReferences;

  const matchingEntries = matchedCandidates.filter(
    (item) =>
      (item.year === yearNum || !item.year) &&
      (item.lowerAuthors.some((a) => a.includes(surname)) ||
        (item.lowerCitation.includes(surname) && item.lowerCitation.includes(yearStr))),
  );
  if (matchingEntries.length === 0) return null;

  const scoreEntry = (item: IndexedReferenceEntry): number => {
    let score = 0;
    if (item.year === yearNum) score += 1;
    if (
      coAuthorSurname &&
      (item.lowerAuthors.some((a) => a.includes(coAuthorSurname)) ||
        item.lowerCitation.includes(coAuthorSurname))
    ) {
      score += 4;
    }
    if (item.lowerCitation.includes(yearToken)) {
      score += yearToken.length > 4 ? 4 : 2;
    }
    return score;
  };

  let foundEntry = matchingEntries[0]!;
  let bestScore = scoreEntry(foundEntry);
  for (let i = 1; i < matchingEntries.length; i += 1) {
    const candidate = matchingEntries[i]!;
    const candidateScore = scoreEntry(candidate);
    if (candidateScore > bestScore) {
      foundEntry = candidate;
      bestScore = candidateScore;
    }
  }

  const cleanBadge = match[0].replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  return buildReferenceOverlayEntry(cleanBadge, foundEntry, undefined, cleanBadge);
}

function resolveFigureByNumber(
  numRaw: string,
  lookup: SemanticLookupIndex,
): SemanticOverlayEntry | null {
  if (lookup.figureList.length === 0) return null;
  const figNum = numRaw.toLowerCase();
  const foundFig =
    lookup.figuresByNumber.get(figNum) ||
    lookup.figuresByNumber.get(`fig-${figNum}`) ||
    lookup.figureList.find((item) => item.lowerLabel.includes(figNum))?.fig;
  if (!foundFig) return null;
  return {
    badge: foundFig.label || `Fig. ${numRaw}`,
    title: foundFig.label || `Figure ${numRaw}`,
    rawFallback: foundFig.caption || 'Figure in document',
    snippet: foundFig.caption || undefined,
    targetPage: foundFig.page,
    targetYRatio: foundFig.coords?.y,
  };
}

function resolveTableByNumber(
  numRaw: string,
  lookup: SemanticLookupIndex,
): SemanticOverlayEntry | null {
  if (lookup.tableList.length === 0) return null;
  const tblNum = numRaw.toLowerCase();
  const foundTbl =
    lookup.tablesByNumber.get(tblNum) ||
    lookup.tablesByNumber.get(`table-${tblNum}`) ||
    lookup.tableList.find((item) => item.lowerLabel.includes(tblNum))?.tbl;
  if (!foundTbl) return null;
  return {
    badge: foundTbl.label || `Table ${numRaw}`,
    title: foundTbl.label || `Table ${numRaw}`,
    rawFallback: foundTbl.caption || 'Table in document',
    snippet: foundTbl.caption || undefined,
    targetPage: foundTbl.page,
    targetYRatio: foundTbl.coords?.y,
  };
}

function resolveBracketEntries(
  inner: string,
  lookup: SemanticLookupIndex,
): SemanticOverlayEntry[] {
  const nums = parseBracketCitationIndices(inner);
  const entries: SemanticOverlayEntry[] = [];
  for (const num of nums) {
    const found =
      lookup.referencesByNumber.get(num) ?? lookup.indexedReferences[num - 1];
    if (!found) continue;
    entries.push(buildReferenceOverlayEntry(`[${num}]`, found, num));
  }
  return entries;
}

function boxesOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
  tol = 0,
): boolean {
  return (
    Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1) - tol &&
    Math.min(a.y2, b.y2) > Math.max(a.y1, b.y1) - tol
  );
}

function overlapAreaRatio(a: NormalizedPdfRect, b: NormalizedPdfRect): number {
  const interW = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const interH = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  if (interW <= 0 || interH <= 0) return 0;
  const interArea = interW * interH;
  const areaA = Math.max(1e-9, (a.x2 - a.x1) * (a.y2 - a.y1));
  const areaB = Math.max(1e-9, (b.x2 - b.x1) * (b.y2 - b.y1));
  return interArea / Math.min(areaA, areaB);
}

function hasOverlappingOverlay(
  candidateRects: NormalizedPdfRect[],
  existing: SemanticPageOverlay[],
  threshold = 0.5,
): boolean {
  for (const cand of candidateRects) {
    for (const overlay of existing) {
      for (const ex of overlay.rects) {
        if (overlapAreaRatio(cand, ex) >= threshold) {
          return true;
        }
      }
    }
  }
  return false;
}

function isExternalLinkOnly(link: PdfLinkRectGeometry): boolean {
  if (!link.url) return false;
  if (link.dest !== undefined && link.dest !== null) return false;
  return /^(?:https?:|mailto:|tel:|ftp:)/i.test(link.url);
}

function extractSlicedTextForLink(
  link: PdfLinkRectGeometry,
  textItems: PdfTextTokenGeometry[],
): { text: string; contextPrefix: string } {
  const tol = 0.002;
  const overlapping = textItems
    .filter((item) => item.str && boxesOverlap(item, link, tol))
    .sort((a, b) => {
      const cyA = (a.y1 + a.y2) / 2;
      const cyB = (b.y1 + b.y2) / 2;
      const maxH = Math.max(a.y2 - a.y1, b.y2 - b.y1);
      if (Math.abs(cyA - cyB) <= maxH * 0.5) {
        return a.x1 - b.x1;
      }
      return cyA - cyB;
    });

  if (overlapping.length === 0) {
    return { text: '', contextPrefix: '' };
  }

  let contextPrefix = '';
  const parts: Array<{ str: string; item: PdfTextTokenGeometry }> = [];

  for (const item of overlapping) {
    const w = item.x2 - item.x1;
    const len = item.str.length;
    if (w <= 0 || len === 0) continue;

    const f0 = clamp01((link.x1 - 0.002 - item.x1) / w);
    const f1 = clamp01((link.x2 + 0.002 - item.x1) / w);

    if (f0 <= 0.03 && f1 >= 0.97) {
      parts.push({ str: item.str, item });
      continue;
    }

    let i0 = Math.max(0, Math.min(len, Math.floor(f0 * len)));
    let i1 = Math.max(i0, Math.min(len, Math.ceil(f1 * len)));
    while (i0 > 0 && /\S/.test(item.str[i0 - 1]!) && (i0 === len || /\S/.test(item.str[i0]!))) {
      i0 -= 1;
    }
    while (i1 < len && /\S/.test(item.str[i1]!) && (i1 === 0 || /\S/.test(item.str[i1 - 1]!))) {
      i1 += 1;
    }
    if (!contextPrefix && i0 > 0) {
      contextPrefix = item.str.slice(Math.max(0, i0 - 16), i0);
    }
    const sliced = item.str.slice(i0, i1);
    if (sliced.trim()) {
      parts.push({ str: sliced, item });
    }
  }

  let joined = '';
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i]!;
    if (i > 0) {
      const prev = parts[i - 1]!;
      const gap = cur.item.x1 - prev.item.x2;
      if (gap > 0.002 && !joined.endsWith(' ') && !cur.str.startsWith(' ')) {
        joined += ' ';
      }
    }
    joined += cur.str;
  }

  return { text: joined.replace(/\s+/g, ' ').trim(), contextPrefix };
}

function resolveLinkText(
  linkText: string,
  contextPrefix: string,
  lookup: SemanticLookupIndex,
): Pick<SemanticPageOverlay, 'type' | 'kind' | 'entries'> | null {
  if (!linkText) return null;

  const figRegex = new RegExp(FIGURE_CITATION_RE.source, 'i');
  const figMatch = figRegex.exec(linkText);
  if (figMatch) {
    const entry = resolveFigureByNumber(figMatch[1]!, lookup);
    if (entry) return { type: 'internal-link', kind: 'Figure', entries: [entry] };
  }

  const tblRegex = new RegExp(TABLE_CITATION_RE.source, 'i');
  const tblMatch = tblRegex.exec(linkText);
  if (tblMatch) {
    const entry = resolveTableByNumber(tblMatch[1]!, lookup);
    if (entry) return { type: 'internal-link', kind: 'Table', entries: [entry] };
  }

  const bracketRegex = new RegExp(BRACKET_CITATION_RE.source);
  const bracketMatch = bracketRegex.exec(linkText);
  if (bracketMatch) {
    const entries = resolveBracketEntries(bracketMatch[1]!, lookup);
    if (entries.length > 0) return { type: 'citation', kind: 'Reference', entries };
  }

  const authorRegex = new RegExp(AUTHOR_YEAR_CITATION_RE.source, 'u');
  const authorMatch = authorRegex.exec(linkText);
  if (authorMatch) {
    const entry = resolveAuthorYearMatch(authorMatch, lookup);
    if (entry) return { type: 'citation', kind: 'Reference', entries: [entry] };
  }

  // Handle single citation number inside a split /Link (e.g. "24" inside "[9, 25, 24, 34]")
  if (/^\d{1,3}$/.test(linkText)) {
    const num = parseInt(linkText, 10);
    const hasNonCitationLabel = /\b(?:fig\.?|figure|table|tab\.?|sec\.?|section|eq\.?|equation|alg\.?|algorithm|chapter|pp?\.|§)\s*$/i.test(
      contextPrefix,
    );
    const hasCitationDelimiter = /[\[;,–\-—]\s*$/.test(contextPrefix) || contextPrefix === '';
    if (!hasNonCitationLabel && hasCitationDelimiter && num >= 1 && num <= 999) {
      const found =
        lookup.referencesByNumber.get(num) ?? lookup.indexedReferences[num - 1];
      if (found) {
        return {
          type: 'citation',
          kind: 'Reference',
          entries: [buildReferenceOverlayEntry(`[${num}]`, found, num)],
        };
      }
    }
  }

  return null;
}

interface VisualSegment {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  items: PdfTextTokenGeometry[];
}

interface BlockTextSlice {
  segmentId: number;
  startChar: number;
  endChar: number;
  item: PdfTextTokenGeometry;
}

interface ColumnTextBlock {
  segments: VisualSegment[];
  slices: BlockTextSlice[];
  text: string;
}

function groupTextItemsIntoBlocks(textItems: PdfTextTokenGeometry[]): ColumnTextBlock[] {
  const valid = textItems
    .filter((item) => item.str && item.x2 > item.x1 && item.y2 > item.y1)
    .sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  if (valid.length === 0) return [];

  // 1. Group items into visual rows by vertical center + vertical overlap
  const rows: PdfTextTokenGeometry[][] = [];
  for (const item of valid) {
    const itemCy = (item.y1 + item.y2) / 2;
    const itemH = item.y2 - item.y1;
    let matchedRow: PdfTextTokenGeometry[] | undefined;

    for (const row of rows) {
      const ref = row[0]!;
      const refCy = (ref.y1 + ref.y2) / 2;
      const maxH = Math.max(itemH, ref.y2 - ref.y1);
      if (Math.abs(itemCy - refCy) <= maxH * 0.5) {
        matchedRow = row;
        break;
      }
    }

    if (matchedRow) {
      matchedRow.push(item);
    } else {
      rows.push([item]);
    }
  }

  // 2. Split each visual row across large column gutters into independent column segments
  const segments: VisualSegment[] = [];
  let nextSegId = 0;

  for (const row of rows) {
    row.sort((a, b) => a.x1 - b.x1);
    let currentItems: PdfTextTokenGeometry[] = [row[0]!];
    let segX1 = row[0]!.x1;
    let segY1 = row[0]!.y1;
    let segX2 = row[0]!.x2;
    let segY2 = row[0]!.y2;

    const flushSegment = () => {
      segments.push({
        id: nextSegId++,
        x1: segX1,
        y1: segY1,
        x2: segX2,
        y2: segY2,
        items: currentItems,
      });
    };

    for (let i = 1; i < row.length; i++) {
      const item = row[i]!;
      const avgH = Math.max(0.008, segY2 - segY1, item.y2 - item.y1);
      const horizontalGap = item.x1 - segX2;
      if (horizontalGap <= Math.max(0.035, avgH * 2.5)) {
        currentItems.push(item);
        segX1 = Math.min(segX1, item.x1);
        segY1 = Math.min(segY1, item.y1);
        segX2 = Math.max(segX2, item.x2);
        segY2 = Math.max(segY2, item.y2);
      } else {
        flushSegment();
        currentItems = [item];
        segX1 = item.x1;
        segY1 = item.y1;
        segX2 = item.x2;
        segY2 = item.y2;
      }
    }
    flushSegment();
  }

  // 3. Stack column segments top-to-bottom into contiguous single-column blocks so line-wrapped citations match cleanly
  segments.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  const stackedGroups: VisualSegment[][] = [];

  for (const seg of segments) {
    const segH = Math.max(0.008, seg.y2 - seg.y1);
    const segW = seg.x2 - seg.x1;
    let bestGroup: VisualSegment[] | undefined;

    for (let gIdx = stackedGroups.length - 1; gIdx >= 0; gIdx--) {
      const group = stackedGroups[gIdx]!;
      const prev = group[group.length - 1]!;
      const prevH = Math.max(0.008, prev.y2 - prev.y1);
      const prevW = prev.x2 - prev.x1;
      const lineStepGap = seg.y1 - prev.y2;
      const horizOverlap = Math.min(seg.x2, prev.x2) - Math.max(seg.x1, prev.x1);
      const minW = Math.min(segW, prevW);
      const alignedColumn =
        (minW > 0 && horizOverlap >= minW * 0.25) || Math.abs(seg.x1 - prev.x1) <= 0.06;

      if (
        alignedColumn &&
        seg.y1 >= prev.y1 - segH * 0.25 &&
        lineStepGap <= Math.max(segH, prevH) * 1.8
      ) {
        bestGroup = group;
        break;
      }
    }

    if (bestGroup) {
      bestGroup.push(seg);
    } else {
      stackedGroups.push([seg]);
    }
  }

  // 4. Materialize block strings with exact item slice offsets
  return stackedGroups.map((group) => {
    let text = '';
    const slices: BlockTextSlice[] = [];

    for (let sIdx = 0; sIdx < group.length; sIdx++) {
      const seg = group[sIdx]!;
      if (sIdx > 0 && text.length > 0 && !/\s$/.test(text)) {
        text += ' ';
      }

      for (let iIdx = 0; iIdx < seg.items.length; iIdx++) {
        const item = seg.items[iIdx]!;
        if (iIdx > 0) {
          const prevItem = seg.items[iIdx - 1]!;
          const gap = item.x1 - prevItem.x2;
          if (gap > 0.002 && text.length > 0 && !/\s$/.test(text) && !/^\s/.test(item.str)) {
            text += ' ';
          }
        }
        const startChar = text.length;
        text += item.str;
        const endChar = text.length;
        slices.push({
          segmentId: seg.id,
          startChar,
          endChar,
          item,
        });
      }
    }

    return { segments: group, slices, text };
  });
}

function computeSliceRects(
  block: ColumnTextBlock,
  matchStart: number,
  matchEnd: number,
): NormalizedPdfRect[] {
  const bySegment = new Map<number, { x1: number; y1: number; x2: number; y2: number }>();

  for (const slice of block.slices) {
    if (slice.endChar <= matchStart || slice.startChar >= matchEnd) {
      continue;
    }
    const { item } = slice;
    const totalLen = item.str.length;
    if (totalLen <= 0) continue;

    let subStart = Math.max(0, matchStart - slice.startChar);
    let subEnd = Math.min(totalLen, matchEnd - slice.startChar);
    while (subStart < subEnd && /\s/.test(item.str[subStart]!)) {
      subStart += 1;
    }
    while (subEnd > subStart && /\s/.test(item.str[subEnd - 1]!)) {
      subEnd -= 1;
    }
    if (subEnd <= subStart) continue;

    const measured = measureProportionalSubstringRatios(
      item.str,
      subStart,
      subEnd,
      item.fontFamily,
      item.isItalic,
    );
    const r0 = measured ? measured[0] : clamp01(subStart / totalLen);
    const r1 = measured ? measured[1] : clamp01(Math.max(r0, subEnd / totalLen));

    const w = item.x2 - item.x1;
    const subX1 = item.x1 + w * r0;
    const subX2 = item.x1 + w * r1;
    if (subX2 <= subX1) continue;

    const existing = bySegment.get(slice.segmentId);
    if (existing) {
      existing.x1 = Math.min(existing.x1, subX1);
      existing.y1 = Math.min(existing.y1, item.y1);
      existing.x2 = Math.max(existing.x2, subX2);
      existing.y2 = Math.max(existing.y2, item.y2);
    } else {
      bySegment.set(slice.segmentId, {
        x1: subX1,
        y1: item.y1,
        x2: subX2,
        y2: item.y2,
      });
    }
  }

  return Array.from(bySegment.values()).map((b) =>
    toNormalizedPdfRect(b.x1, b.y1, b.x2, b.y2),
  );
}

const BIBLIOGRAPHY_HEADING_RE =
  /^\s*(?:(?:\d+(?:\.\d+)*\.?|[IVX]+\.?)\s+)?(?:r\s*eferences|b\s*ibliography|works\s+cited|literature\s+cited)\s*$/i;

function isMatchAtSegmentLineStart(block: ColumnTextBlock, matchStart: number): boolean {
  const firstSlice = block.slices.find(
    (s) => s.endChar > matchStart && s.startChar <= matchStart,
  );
  if (!firstSlice) return false;
  let segStart = firstSlice.startChar;
  for (const s of block.slices) {
    if (s.segmentId === firstSlice.segmentId && s.startChar < segStart) {
      segStart = s.startChar;
    }
  }
  return block.text.slice(segStart, matchStart).trim().length === 0;
}

/**
 * Pre-computes all semantic overlays (native /Link annotations first, then
 * column-aware text-item matches) in canonical 0-degree PDF coordinates.
 */
export function buildSemanticPageOverlays(
  pageNumber: number,
  geometry: PdfPageHoverGeometry,
  lookup: SemanticLookupIndex,
): SemanticPageOverlay[] {
  const overlays: SemanticPageOverlay[] = [];
  let seq = 0;

  const blocks = groupTextItemsIntoBlocks(geometry.textItems);

  const isFullBibliographyPage =
    lookup.bibliographyStartPage !== undefined &&
    pageNumber > lookup.bibliographyStartPage &&
    (lookup.bibliographyEndPage === undefined || pageNumber < lookup.bibliographyEndPage);

  // Detect visual segments to find any explicit References/Bibliography heading on this page
  const segmentMap = new Map<
    number,
    { startChar: number; endChar: number; x1: number; y1: number; block: ColumnTextBlock }
  >();
  for (const block of blocks) {
    for (const slice of block.slices) {
      const prev = segmentMap.get(slice.segmentId);
      if (prev) {
        prev.startChar = Math.min(prev.startChar, slice.startChar);
        prev.endChar = Math.max(prev.endChar, slice.endChar);
        prev.x1 = Math.min(prev.x1, slice.item.x1);
        prev.y1 = Math.min(prev.y1, slice.item.y1);
      } else {
        segmentMap.set(slice.segmentId, {
          startChar: slice.startChar,
          endChar: slice.endChar,
          x1: slice.item.x1,
          y1: slice.item.y1,
          block,
        });
      }
    }
  }

  const pageSegments = Array.from(segmentMap.values());
  const hasRightColumnSegments = pageSegments.some((seg) => seg.x1 >= 0.48);
  let bibliographyHeading: { x1: number; y1: number; isLeftColumn: boolean } | null = null;
  for (const seg of pageSegments) {
    const segText = seg.block.text.slice(seg.startChar, seg.endChar).trim();
    if (BIBLIOGRAPHY_HEADING_RE.test(segText)) {
      const candidate = {
        x1: seg.x1,
        y1: seg.y1,
        isLeftColumn: seg.x1 < 0.45,
      };
      if (
        !bibliographyHeading ||
        (candidate.isLeftColumn && !bibliographyHeading.isLeftColumn) ||
        (candidate.isLeftColumn === bibliographyHeading.isLeftColumn &&
          candidate.y1 < bibliographyHeading.y1)
      ) {
        bibliographyHeading = candidate;
      }
    }
  }

  const isInBibliographyRegion = (rect: NormalizedPdfRect): boolean => {
    if (isFullBibliographyPage) return true;
    if (!bibliographyHeading) return false;
    if (!hasRightColumnSegments) {
      return rect.y1 >= bibliographyHeading.y1 - 0.005;
    }
    if (bibliographyHeading.isLeftColumn) {
      return rect.x1 >= 0.45 || (rect.x1 < 0.45 && rect.y1 >= bibliographyHeading.y1 - 0.005);
    }
    return rect.x1 >= 0.45 && rect.y1 >= bibliographyHeading.y1 - 0.005;
  };

  // Defensive heuristic: if bibliographyStartPage is unknown and no explicit heading was found,
  // detect bibliography list pages by counting start-of-line [N] labels (>= 3).
  let skipStartOfLineBracketLabels = false;
  if (
    !isFullBibliographyPage &&
    !bibliographyHeading &&
    lookup.bibliographyStartPage === undefined &&
    lookup.indexedReferences.length > 0
  ) {
    let startOfLineCount = 0;
    for (const block of blocks) {
      if (!block.text.trim()) continue;
      const regex = new RegExp(BRACKET_CITATION_RE.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(block.text)) !== null) {
        if (
          /^\[\s*\d{1,3}\s*\]$/.test(m[0].trim()) &&
          isMatchAtSegmentLineStart(block, m.index) &&
          resolveBracketEntries(m[1]!, lookup).length === 1
        ) {
          startOfLineCount += 1;
          if (startOfLineCount >= 3) break;
        }
      }
      if (startOfLineCount >= 3) break;
    }
    skipStartOfLineBracketLabels = startOfLineCount >= 3;
  }

  // Pass 1: Native PDF /Link annotations
  for (const link of geometry.links) {
    const w = link.x2 - link.x1;
    const h = link.y2 - link.y1;
    if (w <= 0 || h <= 0 || w > 0.65 || h > 0.25) continue;
    if (isExternalLinkOnly(link)) continue;

    const { text: linkText, contextPrefix } = extractSlicedTextForLink(link, geometry.textItems);
    const resolved = resolveLinkText(linkText, contextPrefix, lookup);
    if (!resolved || resolved.entries.length === 0) continue;

    const rect = toNormalizedPdfRect(link.x1, link.y1, link.x2, link.y2);
    if (resolved.kind === 'Reference' && isInBibliographyRegion(rect)) continue;
    if (hasOverlappingOverlay([rect], overlays, 0.85)) continue;

    overlays.push({
      id: `p${pageNumber}-link-${seq++}`,
      type: resolved.type,
      source: 'pdf-link',
      pageNumber,
      rects: [rect],
      kind: resolved.kind,
      entries: resolved.entries,
    });
  }

  // Pass 2: Semantic text-item pass across column visual segments

  const runBlockMatcher = (
    regexSource: string,
    flags: string,
    kind: SemanticPageOverlay['kind'],
    type: SemanticPageOverlay['type'],
    resolver: (
      block: ColumnTextBlock,
      m: RegExpExecArray,
    ) => { entries: SemanticOverlayEntry[]; endOverride?: number } | null,
  ) => {
    for (const block of blocks) {
      if (!block.text.trim()) continue;
      const regex = new RegExp(regexSource, flags);
      let m: RegExpExecArray | null;
      while ((m = regex.exec(block.text)) !== null) {
        const res = resolver(block, m);
        if (!res || res.entries.length === 0) continue;

        const matchStart = m.index;
        const matchEnd = res.endOverride ?? matchStart + m[0].length;
        const rects = computeSliceRects(block, matchStart, matchEnd);
        if (rects.length === 0) continue;
        if (kind === 'Reference' && isInBibliographyRegion(rects[0]!)) continue;
        if (
          skipStartOfLineBracketLabels &&
          kind === 'Reference' &&
          /^\[\s*\d{1,3}\s*\]$/.test(block.text.slice(matchStart, matchEnd).trim()) &&
          isMatchAtSegmentLineStart(block, matchStart)
        ) {
          continue;
        }
        if (hasOverlappingOverlay(rects, overlays, 0.5)) continue;

        overlays.push({
          id: `p${pageNumber}-match-${seq++}`,
          type,
          source: 'matched',
          pageNumber,
          rects,
          kind,
          entries: res.entries,
          matchedText: block.text.slice(matchStart, matchEnd),
        });
      }
    }
  };

  if (lookup.figureList.length > 0) {
    runBlockMatcher(FIGURE_CITATION_RE.source, 'gi', 'Figure', 'internal-link', (_b, m) => {
      const entry = resolveFigureByNumber(m[1]!, lookup);
      return entry ? { entries: [entry] } : null;
    });
  }

  if (lookup.tableList.length > 0) {
    runBlockMatcher(TABLE_CITATION_RE.source, 'gi', 'Table', 'internal-link', (_b, m) => {
      const entry = resolveTableByNumber(m[1]!, lookup);
      return entry ? { entries: [entry] } : null;
    });
  }

  if (lookup.indexedReferences.length > 0 && !isFullBibliographyPage) {
    runBlockMatcher(BRACKET_CITATION_RE.source, 'g', 'Reference', 'citation', (_b, m) => {
      const entries = resolveBracketEntries(m[1]!, lookup);
      return entries.length > 0 ? { entries } : null;
    });

    runBlockMatcher(AUTHOR_YEAR_CITATION_RE.source, 'gu', 'Reference', 'citation', (_b, m) => {
      const entry = resolveAuthorYearMatch(m, lookup);
      if (!entry) return null;
      const rawMatch = m[0];
      const trimClosingParen = rawMatch.endsWith(')') && !rawMatch.includes('(');
      return {
        entries: [entry],
        endOverride: trimClosingParen ? m.index + rawMatch.length - 1 : undefined,
      };
    });
  }

  return overlays;
}

/**
 * Hit-tests pre-computed semantic overlays at normalized viewport pointer coordinates `(normX, normY)`.
 * Transforms the pointer back into canonical 0-degree space so hit testing stays accurate at any page rotation.
 */
export function hitTestSemanticOverlays(
  overlays: SemanticPageOverlay[] | undefined,
  normX: number,
  normY: number,
  rotation = 0,
): SemanticPageOverlay | null {
  if (!overlays || overlays.length === 0) return null;
  if (!Number.isFinite(normX) || !Number.isFinite(normY)) return null;
  if (normX < -0.01 || normX > 1.01 || normY < -0.01 || normY > 1.01) return null;

  const pt = rotatePointToCanonical({ x: normX, y: normY }, rotation);
  const tol = 0.002;

  let bestOverlay: SemanticPageOverlay | null = null;
  let bestArea = Infinity;

  for (const overlay of overlays) {
    let hit = false;
    let totalArea = 0;

    for (const r of overlay.rects) {
      totalArea += Math.max(0, r.x2 - r.x1) * Math.max(0, r.y2 - r.y1);
      if (
        pt.x >= r.x1 - tol &&
        pt.x <= r.x2 + tol &&
        pt.y >= r.y1 - tol &&
        pt.y <= r.y2 + tol
      ) {
        hit = true;
      }
    }

    if (hit && totalArea < bestArea) {
      bestArea = totalArea;
      bestOverlay = overlay;
    }
  }

  return bestOverlay;
}

function measureSubstringClientRectInSpan(
  span: HTMLElement,
  matchStart: number,
  matchEnd: number,
): DOMRect | null {
  if (typeof document === 'undefined') return null;
  try {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const len = textNode.data.length;
      if (!startNode && offset + len >= matchStart) {
        startNode = textNode;
        startOffset = Math.max(0, matchStart - offset);
      }
      if (startNode && offset + len >= matchEnd) {
        endNode = textNode;
        endOffset = Math.max(0, matchEnd - offset);
        break;
      }
      offset += len;
    }

    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  } catch {
    return null;
  }
}

/**
 * Refines `source === 'matched'` single-rect overlays using the rendered DOM TextLayer spans
 * (which already reflect PDF.js `scaleX` and justified spacing), leaving native `/Link` overlays untouched.
 */
export function refineSemanticOverlaysWithTextLayer(
  pageEl: HTMLElement | null,
  overlays: SemanticPageOverlay[],
  rotation = 0,
): SemanticPageOverlay[] {
  if (!pageEl || overlays.length === 0) return overlays;

  const spans = Array.from(
    pageEl.querySelectorAll<HTMLElement>(
      '.react-pdf__Page__textLayer span, .react-pdf__Page__textContent span, .textLayer span',
    ),
  );
  if (spans.length === 0) return overlays;

  const pageRect = pageEl.getBoundingClientRect();
  if (pageRect.width <= 0 || pageRect.height <= 0) return overlays;

  const normRot = normalizePageRotation(rotation);
  const spanEntries = spans
    .map((el) => {
      const text = el.textContent || '';
      const rect = el.getBoundingClientRect();
      return { el, text, rect };
    })
    .filter((entry) => entry.text.length > 0 && entry.rect.width > 0 && entry.rect.height > 0);

  if (spanEntries.length === 0) return overlays;

  let changed = false;
  const refined = overlays.map((overlay) => {
    if (overlay.source !== 'matched' || overlay.rects.length !== 1) {
      return overlay;
    }
    const token = overlay.matchedText?.trim() || overlay.entries[0]?.badge?.trim();
    if (!token) return overlay;

    const approxRotated = rotateRectFromCanonical(
      {
        x1: overlay.rects[0]!.x1,
        y1: overlay.rects[0]!.y1,
        x2: overlay.rects[0]!.x2,
        y2: overlay.rects[0]!.y2,
      },
      normRot,
    );
    const approxCx = (approxRotated.x1 + approxRotated.x2) / 2;
    const approxCy = (approxRotated.y1 + approxRotated.y2) / 2;

    let bestDist = Infinity;
    let bestNormBox: { x1: number; y1: number; x2: number; y2: number } | null = null;

    const considerBox = (left: number, top: number, right: number, bottom: number) => {
      const vx1 = (left - pageRect.left) / pageRect.width;
      const vy1 = (top - pageRect.top) / pageRect.height;
      const vx2 = (right - pageRect.left) / pageRect.width;
      const vy2 = (bottom - pageRect.top) / pageRect.height;

      const cx = (vx1 + vx2) / 2;
      const cy = (vy1 + vy2) / 2;
      const dist = Math.hypot(cx - approxCx, cy - approxCy);
      if (dist <= 0.06 && dist < bestDist) {
        bestDist = dist;
        bestNormBox = {
          x1: clamp01(vx1),
          y1: clamp01(vy1),
          x2: clamp01(vx2),
          y2: clamp01(vy2),
        };
      }
    };

    for (const s of spanEntries) {
      const spanVx1 = (s.rect.left - pageRect.left) / pageRect.width;
      const spanVy1 = (s.rect.top - pageRect.top) / pageRect.height;
      const spanVx2 = (s.rect.right - pageRect.left) / pageRect.width;
      const spanVy2 = (s.rect.bottom - pageRect.top) / pageRect.height;

      if (
        approxCx < spanVx1 - 0.08 ||
        approxCx > spanVx2 + 0.08 ||
        approxCy < spanVy1 - 0.06 ||
        approxCy > spanVy2 + 0.06
      ) {
        continue;
      }

      let searchFrom = 0;
      let idx: number;
      while ((idx = s.text.indexOf(token, searchFrom)) !== -1) {
        searchFrom = idx + Math.max(1, token.length);
        const clientRect = measureSubstringClientRectInSpan(s.el, idx, idx + token.length);
        if (!clientRect) continue;
        considerBox(clientRect.left, clientRect.top, clientRect.right, clientRect.bottom);
      }
    }

    // Multi-span same-line search when PDF.js splits a citation token across adjacent spans
    const strippedToken = token.replace(/\s+/g, '');
    if (strippedToken.length > 0) {
      const lineSpans = spanEntries
        .filter((s) => {
          const spanVx1 = (s.rect.left - pageRect.left) / pageRect.width;
          const spanVy1 = (s.rect.top - pageRect.top) / pageRect.height;
          const spanVx2 = (s.rect.right - pageRect.left) / pageRect.width;
          const spanVy2 = (s.rect.bottom - pageRect.top) / pageRect.height;
          return (
            approxCy >= spanVy1 - 0.04 &&
            approxCy <= spanVy2 + 0.04 &&
            spanVx2 >= approxRotated.x1 - 0.12 &&
            spanVx1 <= approxRotated.x2 + 0.12
          );
        })
        .sort((a, b) => a.rect.left - b.rect.left);

      if (lineSpans.length > 0) {
        const charMap: Array<{ span: (typeof spanEntries)[number]; charIndex: number }> = [];
        let strippedLine = '';

        for (const span of lineSpans) {
          for (let ci = 0; ci < span.text.length; ci++) {
            const ch = span.text[ci]!;
            if (!/\s/.test(ch)) {
              strippedLine += ch;
              charMap.push({ span, charIndex: ci });
            }
          }
        }

        let searchFrom = 0;
        let matchIdx: number;
        while ((matchIdx = strippedLine.indexOf(strippedToken, searchFrom)) !== -1) {
          searchFrom = matchIdx + Math.max(1, strippedToken.length);
          const spanRanges = new Map<(typeof spanEntries)[number], { start: number; end: number }>();

          for (let k = matchIdx; k < matchIdx + strippedToken.length; k++) {
            const mapped = charMap[k]!;
            const existing = spanRanges.get(mapped.span);
            if (existing) {
              existing.start = Math.min(existing.start, mapped.charIndex);
              existing.end = Math.max(existing.end, mapped.charIndex + 1);
            } else {
              spanRanges.set(mapped.span, {
                start: mapped.charIndex,
                end: mapped.charIndex + 1,
              });
            }
          }

          let unionLeft = Infinity;
          let unionTop = Infinity;
          let unionRight = -Infinity;
          let unionBottom = -Infinity;
          let valid = true;

          for (const [span, range] of spanRanges.entries()) {
            const rect = measureSubstringClientRectInSpan(span.el, range.start, range.end);
            if (!rect) {
              valid = false;
              break;
            }
            unionLeft = Math.min(unionLeft, rect.left);
            unionTop = Math.min(unionTop, rect.top);
            unionRight = Math.max(unionRight, rect.right);
            unionBottom = Math.max(unionBottom, rect.bottom);
          }

          if (valid && unionRight > unionLeft && unionBottom > unionTop) {
            considerBox(unionLeft, unionTop, unionRight, unionBottom);
          }
        }
      }
    }

    if (!bestNormBox) return overlay;

    const canonicalBox = rotateRectToCanonical(bestNormBox, normRot);
    const exactRect = toNormalizedPdfRect(
      canonicalBox.x1,
      canonicalBox.y1,
      canonicalBox.x2,
      canonicalBox.y2,
    );
    if (
      exactRect.x2 <= exactRect.x1 ||
      exactRect.y2 <= exactRect.y1 ||
      (Math.abs(exactRect.x1 - overlay.rects[0]!.x1) < 0.0005 &&
        Math.abs(exactRect.y1 - overlay.rects[0]!.y1) < 0.0005 &&
        Math.abs(exactRect.x2 - overlay.rects[0]!.x2) < 0.0005 &&
        Math.abs(exactRect.y2 - overlay.rects[0]!.y2) < 0.0005)
    ) {
      return overlay;
    }

    changed = true;
    return {
      ...overlay,
      rects: [exactRect],
    };
  });

  return changed ? refined : overlays;
}
