/**
 * reader.domain.ts
 *
 * Pure domain & citation utilities for the PDF/EPUB Reader.
 */

import type { Item } from '@/features/library/domain/types/core.types';
import type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  DocumentFulltext,
} from '@/features/library/domain/types/reader.schema';
import {
  normalizeReaderAuthors,
  getSurnameForCitation,
  formatInTextCitation,
  formatAnnotationCitation,
  searchPdfPages,
  cyclePdfSearchMatch,
  filterPdfOutlineTree,
  readReaderPreference,
  writeReaderPreference,
  calculateEffectiveViewportDimensions,
  computeEffectivePdfPageWidth,
  computeSpreadPairs,
  isPageInVirtualWindow,
  calculatePageAspectRatio,
  normalizeRectCoordinates,
  cropCanvasSelectionToDataUrl,
  type ViewportParams,
  type PdfTextMatch,
  type PdfSearchCycleResult,
  type PdfOutlineNode,
} from './reader-search-outline';

export {
  normalizeReaderAuthors,
  getSurnameForCitation,
  formatInTextCitation,
  formatAnnotationCitation,
  searchPdfPages,
  cyclePdfSearchMatch,
  filterPdfOutlineTree,
  readReaderPreference,
  writeReaderPreference,
  calculateEffectiveViewportDimensions,
  computeEffectivePdfPageWidth,
  computeSpreadPairs,
  isPageInVirtualWindow,
  calculatePageAspectRatio,
  normalizeRectCoordinates,
  cropCanvasSelectionToDataUrl,
  type ViewportParams,
  type PdfTextMatch,
  type PdfSearchCycleResult,
  type PdfOutlineNode,
};

export const ANNOTATION_COLORS = {
  yellow: { id: 'yellow', name: 'Yellow', semanticLabel: 'General / Important', bg: 'rgba(255, 212, 0, 0.35)', border: '#ffd400' },
  red: { id: 'red', name: 'Red', semanticLabel: 'Disagreement / Critical Error', bg: 'rgba(255, 102, 102, 0.35)', border: '#ff6666' },
  green: { id: 'green', name: 'Green', semanticLabel: 'Methodology / Supporting Evidence', bg: 'rgba(95, 178, 54, 0.35)', border: '#5fb236' },
  blue: { id: 'blue', name: 'Blue', semanticLabel: 'Definition / Background', bg: 'rgba(46, 168, 229, 0.35)', border: '#2ea8e5' },
  purple: { id: 'purple', name: 'Purple', semanticLabel: 'Future Work / Follow-up', bg: 'rgba(162, 138, 229, 0.35)', border: '#a28ae5' },
  magenta: { id: 'magenta', name: 'Magenta', semanticLabel: 'Results / Key Findings', bg: 'rgba(229, 110, 238, 0.35)', border: '#e56eee' },
  orange: { id: 'orange', name: 'Orange', semanticLabel: 'Metrics / Quantitative Data', bg: 'rgba(241, 152, 55, 0.35)', border: '#f19837' },
  gray: { id: 'gray', name: 'Gray', semanticLabel: 'Secondary / Archived', bg: 'rgba(170, 170, 170, 0.35)', border: '#aaaaaa' },
} as const;

export type AnnotationColorId = keyof typeof ANNOTATION_COLORS;

/** Standard 8-Color Academic Annotation Palette */
export const ANNOTATION_PALETTE_COLORS = Object.values(ANNOTATION_COLORS).map((c) => ({
  id: c.id,
  label: c.name,
  hex: c.border,
}));

const HEX_TO_COLOR_ID_MAP = new Map<string, AnnotationColorId>([
  ...Object.values(ANNOTATION_COLORS).map(
    (c): [string, AnnotationColorId] => [c.border.toLowerCase(), c.id],
  ),
  ['#ffeb3b', 'yellow'],
]);

export interface AnnotationFilterCriteria {
  query?: string | null;
  color?: string | null;
  colors?: string[] | null;
  type?: string | null;
  types?: string[] | null;
  tag?: string | null;
  tags?: string[] | null;
  authorId?: string | null;
  pageRange?: [number, number] | null;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export interface Box2DInput {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Projects an arbitrary 2D box into $[0, M_x] \times [0, M_y]$ with guaranteed
 * ordered intervals $0 \le x_1 \le x_2 \le M_x$ and $0 \le y_1 \le y_2 \le M_y$.
 */
function projectBox2D(
  r: Box2DInput,
  maxBoundX = 1,
  maxBoundY = maxBoundX,
): AnnotationRect {
  const sx = r.x1 ?? r.x ?? 0;
  const sy = r.y1 ?? r.y ?? 0;
  const ex = r.x2 ?? (r.width !== undefined ? sx + r.width : sx);
  const ey = r.y2 ?? (r.height !== undefined ? sy + r.height : sy);

  const x1 = clamp(Math.min(sx, ex), 0, maxBoundX);
  const y1 = clamp(Math.min(sy, ey), 0, maxBoundY);
  const x2 = clamp(Math.max(sx, ex), x1, maxBoundX);
  const y2 = clamp(Math.max(sy, ey), y1, maxBoundY);

  return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}

const epsDiff = (a: number, b: number, eps = 0.005): number =>
  Math.abs(a - b) > eps ? a - b : 0;

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
      const pageA = a.pageIndex ?? (a.pageNumber !== undefined ? a.pageNumber - 1 : 0);
      const pageB = b.pageIndex ?? (b.pageNumber !== undefined ? b.pageNumber - 1 : 0);
      const sortIdxCmp =
        a.annotationSortIndex && b.annotationSortIndex && a.annotationSortIndex !== b.annotationSortIndex
          ? a.annotationSortIndex < b.annotationSortIndex
            ? -1
            : 1
          : 0;
      const rectA = (a.rects?.[0] || a.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const rectB = (b.rects?.[0] || b.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;

      return (
        pageA - pageB ||
        sortIdxCmp ||
        epsDiff(rectA?.y1 ?? rectA?.y ?? 0, rectB?.y1 ?? rectB?.y ?? 0) ||
        epsDiff(rectA?.x1 ?? rectA?.x ?? 0, rectB?.x1 ?? rectB?.x ?? 0) ||
        getTimestamp(a.createdAt) - getTimestamp(b.createdAt)
      );
    });
  },

  sortAnnotationsInReadingOrder(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return this.sortAnnotations(annotations);
  },

  sortAnnotationsByMode(
    annotations: ReaderAnnotation[],
    sortBy: 'position' | 'newest' | 'oldest' | 'color' = 'position',
  ): ReaderAnnotation[] {
    if (sortBy === 'position') {
      return this.sortAnnotations(annotations);
    }

    const list = [...annotations];
    if (sortBy === 'newest' || sortBy === 'oldest') {
      const tsMap = new Map<string, number>();
      for (const a of list) {
        const ts = Date.parse(a.createdAt || '');
        tsMap.set(a.id, Number.isNaN(ts) ? 0 : ts);
      }
      const dir = sortBy === 'newest' ? -1 : 1;
      return list.sort((a, b) => ((tsMap.get(a.id) ?? 0) - (tsMap.get(b.id) ?? 0)) * dir);
    }

    return list.sort((a, b) =>
      this.resolveColorId(a.color).localeCompare(this.resolveColorId(b.color)),
    );
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
    const authorIdFilter =
      isCriteriaObject && queryOrCriteria.authorId && queryOrCriteria.authorId !== 'all'
        ? queryOrCriteria.authorId
        : null;

    if (!q && rawColors.length === 0 && rawTypes.length === 0 && rawTags.length === 0 && !hasPageRange && !authorIdFilter) {
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
      if (authorIdFilter && a.authorId !== authorIdFilter) {
        return false;
      }

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
          itemTagNames.some((t) => t.includes(reqTag)),
        );
        if (!matchesAllTags) return false;
      }

      if (q) {
        const selectedText = String((a as Record<string, unknown>).selectedText || '').toLowerCase();
        const pageNumStr = String(a.pageNumber ?? ((a.pageIndex ?? 0) + 1));
        const pageLabelStr = (a.pageLabel || '').toLowerCase();
        const textMatch =
          (a.quoteText || '').toLowerCase().includes(q) ||
          selectedText.includes(q) ||
          (a.text || '').toLowerCase().includes(q) ||
          (a.comment || '').toLowerCase().includes(q) ||
          pageNumStr === q ||
          `p. ${pageNumStr}` === q ||
          (pageLabelStr && (pageLabelStr === q || `p. ${pageLabelStr}` === q)) ||
          itemTagNames.some((t) => t.includes(q));
        if (!textMatch) return false;
      }

      return true;
    });
  },

  normalizeRect(
    rect:
      | (Omit<AnnotationRect, 'width' | 'height'> & { width?: number; height?: number })
      | { x: number; y: number; width: number; height: number },
  ): AnnotationRect {
    return projectBox2D(rect as Box2DInput, 1);
  },

  clampAreaSelectionBounds(
    rect: Box2DInput,
    maxBound = 100,
  ): AnnotationRect {
    return projectBox2D(rect, maxBound);
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

  synthesizeMarkdownNote(
    annotations: ReaderAnnotation[],
    paper?: ReaderDocument | null,
    attachmentId?: string,
    scopeId?: string,
  ): string {
    const sorted = this.sortAnnotationsInReadingOrder(annotations);
    return sorted
      .map((a) => {
        const pageNum = a.pageNumber ?? (a.pageIndex !== undefined ? a.pageIndex + 1 : 1);
        const effAttId = attachmentId || a.attachmentId;
        const citation = formatAnnotationCitation(
          paper,
          effAttId,
          pageNum,
          a.id,
          scopeId,
          a.pageLabel,
        );
        const lines: string[] = [];
        const quote = (a.quoteText || a.text || '').trim();
        if (quote) {
          lines.push(`> "${quote}" ${citation.markdown}`);
        } else {
          lines.push(citation.markdown);
        }
        if (a.comment && a.comment.trim()) {
          lines.push(`\n**Note:** ${a.comment.trim()}`);
        }
        return lines.join('\n');
      })
      .join('\n\n---\n\n');
  },
};

export interface EpubOrSnapshotInfo {
  mode: 'epub' | 'snapshot';
  url: string;
}

export interface RawAttachmentItem {
  id?: string;
  fileId?: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  filename?: string;
  name?: string;
  title?: string;
  attachmentType?: string;
  type?: string;
  viewerFormat?: 'pdf' | 'epub' | 'snapshot' | string;
  linkMode?: string;
}

export type AttachmentCapabilityKind =
  | 'pdf'
  | 'epub'
  | 'snapshot'
  | 'external_link'
  | 'file';

export interface AttachmentCapabilityDescriptor {
  kind: AttachmentCapabilityKind;
  isPdf: boolean;
  isEpub: boolean;
  isSnapshot: boolean;
  isExternalLink: boolean;
  canOpenInReader: boolean;
  targetUrl: string;
}

export function classifyAttachmentDescriptor(
  att?: RawAttachmentItem | Record<string, unknown> | null,
  resolvedDownloadUrl?: string,
): AttachmentCapabilityDescriptor {
  if (!att) {
    return {
      kind: 'file',
      isPdf: false,
      isEpub: false,
      isSnapshot: false,
      isExternalLink: false,
      canOpenInReader: false,
      targetUrl: resolvedDownloadUrl || '',
    };
  }
  const rec = att as RawAttachmentItem;
  const attMime = (rec.mimeType || '').toLowerCase();
  const attName = (rec.filename || rec.name || '').toLowerCase();
  const rawUrl = (rec.fileUrl || rec.url || '').trim();
  const attUrlLower = rawUrl.toLowerCase();
  const attType = (rec.attachmentType || rec.type || '').toLowerCase();
  const viewerFmt = (rec.viewerFormat || '').toLowerCase();

  const isPdf =
    viewerFmt === 'pdf' ||
    attType === 'primary_pdf' ||
    attMime === 'application/pdf' ||
    attMime.includes('pdf') ||
    attName.endsWith('.pdf') ||
    /\.pdf(?:$|[?#])/i.test(attUrlLower);

  const isEpub =
    !isPdf &&
    (viewerFmt === 'epub' ||
      attMime.includes('epub') ||
      attName.endsWith('.epub') ||
      /\.epub(?:$|[?#])/i.test(attUrlLower));

  const isSnapshot =
    !isPdf &&
    !isEpub &&
    (viewerFmt === 'snapshot' ||
      attType === 'web_snapshot' ||
      attType === 'snapshot' ||
      attMime === 'text/html' ||
      attMime === 'application/xhtml+xml' ||
      attName.endsWith('.html') ||
      attName.endsWith('.htm'));

  const isExternalLink =
    !isPdf &&
    !isEpub &&
    !isSnapshot &&
    (rec.linkMode === 'linked_url' ||
      (!rec.fileId && Boolean(rawUrl) && /^https?:\/\//i.test(rawUrl)));

  const kind: AttachmentCapabilityKind = isPdf
    ? 'pdf'
    : isEpub
      ? 'epub'
      : isSnapshot
        ? 'snapshot'
        : isExternalLink
          ? 'external_link'
          : 'file';

  const canOpenInReader = isPdf || isEpub || isSnapshot;
  const targetUrl = resolvedDownloadUrl || rawUrl;

  return {
    kind,
    isPdf,
    isEpub,
    isSnapshot,
    isExternalLink,
    canOpenInReader,
    targetUrl,
  };
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
    const desc = classifyAttachmentDescriptor(activeAtt);
    if (desc.isPdf) return null;
    if (desc.isEpub || desc.isSnapshot) {
      const attUrl = (activeAtt.fileUrl || activeAtt.url || paperUrl || '') as string;
      return attUrl ? { mode: desc.isEpub ? 'epub' : 'snapshot', url: attUrl } : null;
    }
  }

  const primaryDesc = classifyAttachmentDescriptor(
    itemLike.primaryFile as RawAttachmentItem | null,
  );
  if (primaryDesc.isPdf) return null;
  if (primaryDesc.isEpub || primaryDesc.isSnapshot) {
    const primaryUrl = (paperUrl || itemLike.primaryFile?.url || '') as string;
    if (primaryUrl) {
      return { mode: primaryDesc.isEpub ? 'epub' : 'snapshot', url: primaryUrl };
    }
  }

  for (const att of rawAtts) {
    const desc = classifyAttachmentDescriptor(att);
    if (desc.isEpub || desc.isSnapshot) {
      const url = (att.fileUrl || att.url || '') as string;
      if (url) return { mode: desc.isEpub ? 'epub' : 'snapshot', url };
    }
  }

  return null;
}

export function buildReaderPaperUrl(
  itemId: string,
  options?: {
    projectId?: string | null;
    query?: string | null;
    attachmentId?: string | null;
  },
): string {
  const safeId = encodeURIComponent(itemId);
  const queryParts: string[] = [];
  if (
    options?.projectId &&
    options.projectId !== 'user' &&
    options.projectId !== 'me' &&
    options.projectId !== 'personal' &&
    options.projectId !== 'global' &&
    options.projectId !== 'default'
  ) {
    queryParts.push(`projectId=${encodeURIComponent(String(options.projectId))}`);
  }
  if (options?.query) {
    queryParts.push(`q=${encodeURIComponent(String(options.query))}`);
  }
  if (options?.attachmentId) {
    queryParts.push(`attachmentId=${encodeURIComponent(String(options.attachmentId))}`);
  }
  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return `/library/papers/${safeId}${qs}`;
}

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
  _numPages?: number,
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
      (fulltext as { isScanned?: boolean } | null | undefined)?.isScanned,
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
