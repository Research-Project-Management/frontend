/**
 * reader.domain.ts
 *
 * Pure domain & citation utilities for the PDF/EPUB Reader.
 */

import type { Item } from '@/features/library/domain/types/library.types';
import type {
  ReaderAnnotation,
  AnnotationRect,
  ReaderDocument,
  DocumentFulltext,
} from '@/features/library/domain/types/reader.types';
import { isValidValue } from '@/features/library/domain/metadata';
import {
  normalizeReaderAuthors,
  getSurnameForCitation,
  generateReaderCitationKey,
  formatInTextCitation,
  formatAnnotationCitation,
  searchPdfPages,
  cyclePdfSearchMatch,
  filterPdfOutlineTree,
  readReaderPreference,
  writeReaderPreference,
  type PdfTextMatch,
  type PdfSearchCycleResult,
  type PdfOutlineNode,
} from './reader-persistence.helpers';

export {
  normalizeReaderAuthors,
  getSurnameForCitation,
  generateReaderCitationKey,
  formatInTextCitation,
  formatAnnotationCitation,
  searchPdfPages,
  cyclePdfSearchMatch,
  filterPdfOutlineTree,
  readReaderPreference,
  writeReaderPreference,
  type PdfTextMatch,
  type PdfSearchCycleResult,
  type PdfOutlineNode,
};

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

/** Standard 8-Color Academic Annotation Palette */
export const ANNOTATION_PALETTE_COLORS = Object.values(ANNOTATION_COLORS).map((c) => ({
  id: c.id,
  label: c.name,
  hex: c.border,
}));

const HEX_TO_COLOR_ID_MAP = new Map<string, AnnotationColorId>(
  Object.values(ANNOTATION_COLORS).map((c) => [c.border.toLowerCase(), c.id]),
);

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

export const PdfAnnotationEngine = {
  sortAnnotations(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    if (annotations.length <= 1) return [...annotations];

    let timestampCache: Map<string, number> | null = null;
    const getTimestamp = (iso?: string | null): number => {
      if (!iso) return 0;
      if (!timestampCache) timestampCache = new Map();
      const cached = timestampCache.get(iso);
      if (cached !== undefined) return cached;
      const parsed = Date.parse(iso) || 0;
      timestampCache.set(iso, parsed);
      return parsed;
    };

    return [...annotations].sort((a, b) => {
      if (a.annotationSortIndex && b.annotationSortIndex && a.annotationSortIndex !== b.annotationSortIndex) {
        return a.annotationSortIndex < b.annotationSortIndex ? -1 : 1;
      }

      const pageA = a.pageIndex ?? (a.pageNumber !== undefined ? a.pageNumber - 1 : 0);
      const pageB = b.pageIndex ?? (b.pageNumber !== undefined ? b.pageNumber - 1 : 0);
      if (pageA !== pageB) return pageA - pageB;

      const rectA = (a.rects?.[0] || a.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const rectB = (b.rects?.[0] || b.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const topA = rectA?.y1 ?? rectA?.y ?? 0;
      const topB = rectB?.y1 ?? rectB?.y ?? 0;
      if (Math.abs(topA - topB) > 0.005) return topA - topB;

      const leftA = rectA?.x1 ?? rectA?.x ?? 0;
      const leftB = rectB?.x1 ?? rectB?.x ?? 0;
      if (Math.abs(leftA - leftB) > 0.005) return leftA - leftB;

      return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
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
    return HEX_TO_COLOR_ID_MAP.get(lower) ?? 'yellow';
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
    const hasPageRange = Boolean(pageRange && pageRange.length === 2);

    if (!q && rawColors.length === 0 && rawTypes.length === 0 && rawTags.length === 0 && !hasPageRange) {
      return [...annotations];
    }

    const resolvedColorIds = new Set<AnnotationColorId>();
    const rawColorSet = new Set<string>();
    for (const c of rawColors) {
      rawColorSet.add(c);
      if (c in ANNOTATION_COLORS) {
        resolvedColorIds.add(c as AnnotationColorId);
        rawColorSet.add(ANNOTATION_COLORS[c as AnnotationColorId].border.toLowerCase());
      } else {
        resolvedColorIds.add(this.resolveColorId(c));
      }
    }
    const typeSet = new Set<string>(rawTypes);
    const needTags = Boolean(q || rawTags.length > 0);

    return annotations.filter((a) => {
      if (hasPageRange && pageRange) {
        const pageNum = a.pageNumber ?? (a.pageIndex !== undefined ? a.pageIndex + 1 : 1);
        if (pageNum < pageRange[0] || pageNum > pageRange[1]) return false;
      }

      if (typeSet.size > 0) {
        const itemType = (a.type || 'highlight').toLowerCase();
        if (!typeSet.has(itemType)) return false;
      }

      if (rawColors.length > 0) {
        const itemColor = (a.color || '#ffd400').toLowerCase();
        const itemColorId = this.resolveColorId(itemColor);
        const matchesColor = rawColorSet.has(itemColor) || resolvedColorIds.has(itemColorId);
        if (!matchesColor) return false;
      }

      const itemTagNames = needTags && Array.isArray((a as Record<string, unknown>).tags)
        ? ((a as Record<string, unknown>).tags as unknown[])
            .map((t) =>
              (typeof t === 'string' ? t : (t as { name?: string })?.name || '')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean)
        : [];

      if (rawTags.length > 0) {
        const matchesAllTags = rawTags.every((reqTag) =>
          itemTagNames.some((t) => t === reqTag || t.includes(reqTag)),
        );
        if (!matchesAllTags) return false;
      }

      if (q) {
        const selectedText = String((a as Record<string, unknown>).selectedText || '').toLowerCase();
        const textMatch =
          (a.quoteText || '').toLowerCase().includes(q) ||
          selectedText.includes(q) ||
          (a.text || '').toLowerCase().includes(q) ||
          (a.comment || '').toLowerCase().includes(q) ||
          itemTagNames.some((t) => t.includes(q));
        if (!textMatch) return false;
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
    if (colorId) {
      const resolvedId = this.resolveColorId(colorId);
      const c = ANNOTATION_COLORS[resolvedId];
      return { bg: c.bg, border: c.border, semanticLabel: c.semanticLabel };
    }
    return {
      bg: ANNOTATION_COLORS.yellow.bg,
      border: ANNOTATION_COLORS.yellow.border,
      semanticLabel: ANNOTATION_COLORS.yellow.semanticLabel,
    };
  },
};

export interface EpubOrSnapshotInfo {
  mode: 'epub' | 'snapshot';
  url: string;
}

export interface RawAttachmentItem {
  id?: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  filename?: string;
  attachmentType?: string;
  linkMode?: string;
}

export function resolveEpubOrSnapshot(
  paper?: Partial<Item> | Record<string, unknown> | null,
  paperUrl?: string | null,
  requestedAttId?: string | null,
  selectedAttachment?: RawAttachmentItem | null,
): EpubOrSnapshotInfo | null {
  if (!paper) return null;
  const itemLike = paper as Partial<Item>;
  const rawAtts: RawAttachmentItem[] = Array.isArray(itemLike.attachments)
    ? (itemLike.attachments as RawAttachmentItem[])
    : [];

  const activeAtt = requestedAttId
    ? rawAtts.find((a: RawAttachmentItem) => a.id === requestedAttId)
    : selectedAttachment;

  if (activeAtt) {
    const attMime = activeAtt.mimeType?.toLowerCase() || '';
    const attName = (activeAtt.filename || '').toLowerCase();
    const attUrl = (activeAtt.fileUrl || activeAtt.url || paperUrl || '') as string;

    const isPdf =
      activeAtt.attachmentType === 'primary_pdf' ||
      attMime === 'application/pdf' ||
      attMime.includes('pdf') ||
      attName.endsWith('.pdf') ||
      /\.pdf(?:$|[?#])/i.test(attUrl);

    if (isPdf) {
      return null;
    }

    const isEpub =
      attMime.includes('epub') ||
      attName.endsWith('.epub') ||
      /\.epub(?:$|[?#])/i.test(attUrl);

    if (isEpub) {
      return { mode: 'epub', url: attUrl };
    }

    const isSnapshot =
      (activeAtt.attachmentType === 'snapshot' ||
        activeAtt.attachmentType === 'web_snapshot' ||
        attMime === 'text/html' ||
        attMime === 'application/xhtml+xml' ||
        attName.endsWith('.html') ||
        attName.endsWith('.htm') ||
        attName.endsWith('.xhtml') ||
        attName.endsWith('.mhtml'));

    if (isSnapshot) {
      return { mode: 'snapshot', url: attUrl };
    }
  }

  const primaryMime = itemLike.primaryFile?.mimeType?.toLowerCase() || '';
  const primaryName = String(
    itemLike.filename ||
    itemLike.primaryFile?.filename ||
    ''
  ).toLowerCase();

  const primaryIsPdf =
    primaryMime === 'application/pdf' ||
    primaryMime.includes('pdf') ||
    primaryName.endsWith('.pdf') ||
    (paperUrl ? /\.pdf(?:$|[?#])/i.test(paperUrl) : false);

  if (
    !primaryIsPdf &&
    (primaryMime.includes('epub') ||
      primaryName.endsWith('.epub') ||
      (paperUrl && /\.epub(?:$|[?#])/i.test(paperUrl)))
  ) {
    return {
      mode: 'epub',
      url: paperUrl || itemLike.primaryFile?.url || '',
    };
  }

  const epubAtt = rawAtts.find((a: RawAttachmentItem) => {
    const mime = a.mimeType?.toLowerCase() || '';
    const name = (a.filename || '').toLowerCase();
    const url = (a.fileUrl || a.url || '') as string;
    const isPdf =
      a.attachmentType === 'primary_pdf' ||
      mime.includes('pdf') ||
      name.endsWith('.pdf') ||
      /\.pdf(?:$|[?#])/i.test(url);
    if (isPdf) return false;
    return mime.includes('epub') || name.endsWith('.epub') || /\.epub(?:$|[?#])/i.test(url);
  });
  if (epubAtt && (epubAtt.url || epubAtt.fileUrl)) {
    return {
      mode: 'epub',
      url: (epubAtt.fileUrl || epubAtt.url) as string,
    };
  }

  if (!paperUrl && !primaryIsPdf) {
    const snapshotAtt = rawAtts.find((a: RawAttachmentItem) => {
      const mime = a.mimeType?.toLowerCase() || '';
      const name = (a.filename || '').toLowerCase();
      const url = (a.fileUrl || a.url || '') as string;
      const isPdf =
        a.attachmentType === 'primary_pdf' ||
        mime.includes('pdf') ||
        name.endsWith('.pdf') ||
        /\.pdf(?:$|[?#])/i.test(url);
      if (isPdf) return false;

      return (
        a.attachmentType === 'snapshot' ||
        a.attachmentType === 'web_snapshot' ||
        mime === 'text/html' ||
        mime === 'application/xhtml+xml' ||
        name.endsWith('.html') ||
        name.endsWith('.htm') ||
        name.endsWith('.xhtml') ||
        name.endsWith('.mhtml')
      );
    });
    if (snapshotAtt && (snapshotAtt.url || snapshotAtt.fileUrl)) {
      return {
        mode: 'snapshot',
        url: (snapshotAtt.fileUrl || snapshotAtt.url) as string,
      };
    }
  }

  return null;
}

export const resolveEpubOrSnapshotAttachment = resolveEpubOrSnapshot;

export type OcrStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'none';

export interface DocumentOcrState {
  isScanned: boolean;
  ocrStatus: OcrStatus;
}

export function resolveDocumentOcrState(
  paper:
    | {
        attachments?: Array<{ id?: string; [key: string]: unknown }>;
        [key: string]: unknown;
      }
    | null
    | undefined,
  effectiveAttachmentId: string | undefined,
  fulltext: DocumentFulltext | null | undefined,
  numPages: number,
): DocumentOcrState {
  const primaryAttachment =
    paper?.attachments?.find((a) => a.id === effectiveAttachmentId) ||
    paper?.attachments?.[0];

  const primaryAttachmentRecord = primaryAttachment as
    | Record<string, unknown>
    | undefined;
  const attachmentMeta = primaryAttachmentRecord?.metadata as
    | Record<string, unknown>
    | undefined;
  const paperRecord = paper as Record<string, unknown> | null | undefined;
  const paperMeta = paperRecord?.metadata as
    | Record<string, unknown>
    | undefined;

  const isScanned = Boolean(
    attachmentMeta?.isScanned ||
      paperMeta?.isScanned ||
      (fulltext &&
        (!fulltext.sections || fulltext.sections.length === 0) &&
        (!fulltext.abstract || fulltext.abstract.length === 0) &&
        numPages > 0),
  );

  const rawExtractionStatus = (
    primaryAttachment as Record<string, unknown> | undefined
  )?.extractionStatus;
  const rawOcrStatus =
    (typeof rawExtractionStatus === 'string'
      ? rawExtractionStatus.toLowerCase()
      : null) ||
    (typeof attachmentMeta?.ocrStatus === 'string'
      ? attachmentMeta.ocrStatus
      : null) ||
    (typeof paperMeta?.ocrStatus === 'string' ? paperMeta.ocrStatus : null) ||
    'none';

  const ocrStatus = (
    ['pending', 'processing', 'ready', 'completed', 'none'].includes(
      rawOcrStatus,
    )
  )
    ? (rawOcrStatus as OcrStatus)
    : 'none';

  return { isScanned, ocrStatus };
}
