/**
 * PDF Reader Annotation Geometry Domain
 *
 * Pure coordinate transformation and rectangle normalization utilities:
 * - Page-rotation invariant [0, 1] canonical coordinates (0 / 90 / 180 / 270 deg)
 * - Horizontal rect coalescing (same-line span merging without bridging column gutters)
 * - Vertical overlap splitting (prevents multiply-blend seams between adjacent lines)
 * - Cross-page DOM Range partitioning into per-page normalized segments
 */

import type { AnnotationRect } from '@/features/library/types/reader.types';

export type NormalizedRotation = 0 | 90 | 180 | 270;

export interface NormalizedPoint2D {
  x: number;
  y: number;
}

export interface SelectionPageSegment {
  pageNum: number;
  text: string;
  rects: AnnotationRect[];
}

export function normalizePdfSelectionText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .replace(/(\p{L})-\s+(\p{L})/gu, '$1$2')
    .replace(/[ \t]*\n+[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Number(clamp01(value).toFixed(4));
}

function toFullBox(rect: AnnotationRect): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
} {
  const rawX1 = rect.x1;
  const rawY1 = rect.y1;
  const rawX2 = rect.x2 ?? rect.x1 + (rect.width ?? 0);
  const rawY2 = rect.y2 ?? rect.y1 + (rect.height ?? 0);
  const x1 = clamp01(Math.min(rawX1, rawX2));
  const x2 = clamp01(Math.max(rawX1, rawX2));
  const y1 = clamp01(Math.min(rawY1, rawY2));
  const y2 = clamp01(Math.max(rawY1, rawY2));
  return {
    x1,
    y1,
    x2,
    y2,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  };
}

/**
 * Snaps an arbitrary degree value to canonical quarter-turn rotation: 0, 90, 180, or 270.
 */
export function normalizePageRotation(rotation?: number): NormalizedRotation {
  if (typeof rotation !== 'number' || !Number.isFinite(rotation)) return 0;
  const snapped = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  if (snapped === 90 || snapped === 180 || snapped === 270) return snapped;
  return 0;
}

/**
 * Inverse rotation: converts a normalized point from viewport rotation `theta`
 * back into canonical 0-degree page coordinates.
 */
export function rotatePointToCanonical(
  pt: NormalizedPoint2D,
  rotation?: number,
): NormalizedPoint2D {
  const rot = normalizePageRotation(rotation);
  const x = clamp01(pt.x);
  const y = clamp01(pt.y);
  switch (rot) {
    case 90:
      return { x: y, y: clamp01(1 - x) };
    case 180:
      return { x: clamp01(1 - x), y: clamp01(1 - y) };
    case 270:
      return { x: clamp01(1 - y), y: x };
    default:
      return { x, y };
  }
}

/**
 * Forward rotation: projects a canonical 0-degree point onto a page rotated
 * clockwise by `theta` degrees (matching React-PDF / PDF.js `rotate`).
 */
export function rotatePointFromCanonical(
  pt: NormalizedPoint2D,
  rotation?: number,
): NormalizedPoint2D {
  const rot = normalizePageRotation(rotation);
  const x = clamp01(pt.x);
  const y = clamp01(pt.y);
  switch (rot) {
    case 90:
      return { x: clamp01(1 - y), y: x };
    case 180:
      return { x: clamp01(1 - x), y: clamp01(1 - y) };
    case 270:
      return { x: y, y: clamp01(1 - x) };
    default:
      return { x, y };
  }
}

function transformRectWithMapper(
  rect: AnnotationRect,
  mapper: (pt: NormalizedPoint2D, rotation?: number) => NormalizedPoint2D,
  rotation?: number,
): AnnotationRect {
  const rot = normalizePageRotation(rotation);
  const box = toFullBox(rect);
  const extra = {
    ...(rect.paths !== undefined ? { paths: rect.paths } : {}),
    ...(rect.imageDataUrl !== undefined ? { imageDataUrl: rect.imageDataUrl } : {}),
  };

  if (rot === 0) {
    return {
      x1: round4(box.x1),
      y1: round4(box.y1),
      x2: round4(box.x2),
      y2: round4(box.y2),
      width: round4(box.width),
      height: round4(box.height),
      ...extra,
    };
  }

  const p1 = mapper({ x: box.x1, y: box.y1 }, rot);
  const p2 = mapper({ x: box.x2, y: box.y2 }, rot);
  const x1 = round4(Math.min(p1.x, p2.x));
  const x2 = round4(Math.max(p1.x, p2.x));
  const y1 = round4(Math.min(p1.y, p2.y));
  const y2 = round4(Math.max(p1.y, p2.y));

  return {
    x1,
    y1,
    x2,
    y2,
    width: round4(Math.max(0, x2 - x1)),
    height: round4(Math.max(0, y2 - y1)),
    ...extra,
  };
}

/**
 * Converts a normalized rect captured at viewport `rotation` into canonical 0-degree page coordinates.
 */
export function rotateRectToCanonical(
  rect: AnnotationRect,
  rotation?: number,
): AnnotationRect {
  return transformRectWithMapper(rect, rotatePointToCanonical, rotation);
}

/**
 * Projects a canonical 0-degree normalized rect onto a page rendered at `rotation` degrees.
 */
export function rotateRectFromCanonical(
  rect: AnnotationRect,
  rotation?: number,
): AnnotationRect {
  return transformRectWithMapper(rect, rotatePointFromCanonical, rotation);
}

/**
 * Coalesces horizontally adjacent DOM text-selection rects on the same visual line
 * while keeping separated multi-column blocks apart (vertical overlap >= 50% of min height
 * and horizontal gap <= max(0.012, min(h1, h2) * 0.75)).
 */
export function coalesceHorizontalRects(
  rects: AnnotationRect[],
): AnnotationRect[] {
  const valid = rects
    .map(toFullBox)
    .filter((b) => b.width > 0.0005 && b.height > 0.0005);

  if (valid.length === 0) return [];

  valid.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  // Partition into visual lines first so 2-column jittered y1 values cannot interrupt merging
  const lines: Array<typeof valid> = [];
  for (const box of valid) {
    let targetLine: (typeof valid) | undefined;
    for (const line of lines) {
      const ref = line[0];
      const minH = Math.min(box.height, ref.height);
      const overlapY = Math.min(box.y2, ref.y2) - Math.max(box.y1, ref.y1);
      if (minH > 0 && overlapY >= minH * 0.5) {
        targetLine = line;
        break;
      }
    }
    if (targetLine) {
      targetLine.push(box);
    } else {
      lines.push([box]);
    }
  }

  const merged: AnnotationRect[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
    let curr = { ...line[0] };

    for (let i = 1; i < line.length; i++) {
      const next = line[i];
      const minH = Math.min(curr.height, next.height);
      const overlapY = Math.min(curr.y2, next.y2) - Math.max(curr.y1, next.y1);
      const gapX = next.x1 - curr.x2;
      const maxGap = Math.max(0.012, minH * 0.75);

      if (minH > 0 && overlapY >= minH * 0.5 && gapX <= maxGap) {
        const x1 = Math.min(curr.x1, next.x1);
        const y1 = Math.min(curr.y1, next.y1);
        const x2 = Math.max(curr.x2, next.x2);
        const y2 = Math.max(curr.y2, next.y2);
        curr = {
          x1,
          y1,
          x2,
          y2,
          width: x2 - x1,
          height: y2 - y1,
        };
      } else {
        merged.push({
          x1: round4(curr.x1),
          y1: round4(curr.y1),
          x2: round4(curr.x2),
          y2: round4(curr.y2),
          width: round4(curr.width),
          height: round4(curr.height),
        });
        curr = { ...next };
      }
    }

    merged.push({
      x1: round4(curr.x1),
      y1: round4(curr.y1),
      x2: round4(curr.x2),
      y2: round4(curr.y2),
      width: round4(curr.width),
      height: round4(curr.height),
    });
  }

  merged.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  return merged;
}

/**
 * Eliminates vertical overlap between consecutive lines that also overlap horizontally,
 * preventing dark multiply-blend seams without disturbing side-by-side columns.
 */
export function splitVerticalOverlaps(
  rects: AnnotationRect[],
): AnnotationRect[] {
  if (rects.length === 0) return [];

  const normalized = rects.map((raw) => {
    const box = toFullBox(raw);
    return {
      ...raw,
      ...box,
    };
  });

  if (normalized.length === 1) return normalized;

  normalized.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  for (let i = 0; i < normalized.length - 1; i++) {
    const curr = normalized[i];
    for (let j = i + 1; j < normalized.length && normalized[j].y1 < curr.y2; j++) {
      const next = normalized[j];
      const horizOverlap =
        Math.min(curr.x2, next.x2) > Math.max(curr.x1, next.x1);
      if (horizOverlap && next.y1 < curr.y2 && next.y2 > curr.y2) {
        const splitY = round4((curr.y2 + next.y1) / 2);
        curr.y2 = splitY;
        curr.height = round4(Math.max(0.001, curr.y2 - curr.y1));
        next.y1 = splitY;
        next.height = round4(Math.max(0.001, next.y2 - next.y1));
      }
    }
  }

  return normalized;
}

/**
 * Coalesces horizontal text-layer fragments and trims adjacent vertical seams.
 */
export function coalesceAndNormalizeTextRects(
  rects: AnnotationRect[],
): AnnotationRect[] {
  return splitVerticalOverlaps(coalesceHorizontalRects(rects));
}

interface MeasuredPageContainer {
  pageNum: number;
  el: HTMLElement;
  rect: DOMRect;
}

function rectsIntersectWithTolerance(a: DOMRect, b: DOMRect, tol = 1): boolean {
  return (
    a.right >= b.left - tol &&
    a.left <= b.right + tol &&
    a.bottom >= b.top - tol &&
    a.top <= b.bottom + tol
  );
}

function findOwnerPageForClientRect(
  cr: DOMRect,
  pages: MeasuredPageContainer[],
): MeasuredPageContainer | null {
  const cx = cr.left + cr.width / 2;
  const cy = cr.top + cr.height / 2;

  for (const page of pages) {
    const r = page.rect;
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
      return page;
    }
  }

  let bestPage: MeasuredPageContainer | null = null;
  let bestScore = 0;
  for (const page of pages) {
    const r = page.rect;
    const overlapX = Math.max(0, Math.min(cr.right, r.right) - Math.max(cr.left, r.left));
    const overlapY = Math.max(0, Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top));
    const area = overlapX * overlapY;
    const score = area > 0 ? area : overlapY;
    if (score > bestScore) {
      bestScore = score;
      bestPage = page;
    }
  }

  return bestPage;
}

function extractTextForPageInRange(range: Range, pageEl: HTMLElement): string {
  if (
    typeof document === 'undefined' ||
    typeof Range === 'undefined' ||
    typeof range.cloneRange !== 'function' ||
    typeof range.compareBoundaryPoints !== 'function'
  ) {
    return '';
  }

  const textRoot =
    (pageEl.querySelector('.react-pdf__Page__textContent, .textLayer') as HTMLElement | null) ??
    pageEl;

  try {
    const pageRange = document.createRange();
    pageRange.selectNodeContents(textRoot);

    // No intersection when range ends before page starts or starts after page ends
    if (range.compareBoundaryPoints(Range.START_TO_END, pageRange) <= 0) return '';
    if (range.compareBoundaryPoints(Range.END_TO_START, pageRange) >= 0) return '';

    const clipped = range.cloneRange();
    if (clipped.compareBoundaryPoints(Range.START_TO_START, pageRange) < 0) {
      clipped.setStart(pageRange.startContainer, pageRange.startOffset);
    }
    if (clipped.compareBoundaryPoints(Range.END_TO_END, pageRange) > 0) {
      clipped.setEnd(pageRange.endContainer, pageRange.endOffset);
    }
    return clipped.toString().trim();
  } catch {
    return '';
  }
}

/**
 * Partitions a browser selection `Range` (within `container`) into per-page segments,
 * normalizing, coalescing horizontal fragments, splitting vertical seams, and projecting
 * viewport rects back into canonical 0-degree coordinates.
 */
export function extractSelectionSegmentsByPage(
  range: Range,
  container: HTMLElement,
  fullText: string,
  fallbackPageNum: number,
  rotation = 0,
): SelectionPageSegment[] {
  const rawClientRects = Array.from(range.getClientRects()).filter(
    (cr) => cr.width > 0.5 && cr.height > 0.5,
  );
  const bounding = range.getBoundingClientRect();
  const rectsToUse =
    rawClientRects.length > 0
      ? rawClientRects
      : bounding.width > 0.5 && bounding.height > 0.5
        ? [bounding]
        : [];

  if (rectsToUse.length === 0) {
    return [];
  }

  const allPageEls = Array.from(
    container.querySelectorAll<HTMLElement>('[data-page-num]'),
  );
  const measuredPages: MeasuredPageContainer[] = [];

  for (const el of allPageEls) {
    const pageNum = Number(el.dataset.pageNum);
    if (!Number.isFinite(pageNum) || pageNum < 1) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const containsBoundary =
      el.contains(range.startContainer) || el.contains(range.endContainer);
    if (containsBoundary || rectsIntersectWithTolerance(rect, bounding, 2)) {
      measuredPages.push({ pageNum, el, rect });
    }
  }

  if (measuredPages.length === 0) {
    const fallbackEl = container.querySelector<HTMLElement>(
      `[data-page-num="${fallbackPageNum}"]`,
    );
    if (fallbackEl) {
      const rect = fallbackEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        measuredPages.push({ pageNum: fallbackPageNum, el: fallbackEl, rect });
      }
    }
  }

  if (measuredPages.length === 0) {
    return [];
  }

  const rawByPage = new Map<
    number,
    { page: MeasuredPageContainer; rects: AnnotationRect[] }
  >();

  for (const cr of rectsToUse) {
    const owner =
      measuredPages.length === 1
        ? measuredPages[0]
        : findOwnerPageForClientRect(cr, measuredPages);
    if (!owner) continue;

    const pageRect = owner.rect;
    const x1 = clamp01((cr.left - pageRect.left) / pageRect.width);
    const y1 = clamp01((cr.top - pageRect.top) / pageRect.height);
    const width = Math.min(1 - x1, Math.max(0, cr.width / pageRect.width));
    const height = Math.min(1 - y1, Math.max(0, cr.height / pageRect.height));
    if (width <= 0.001 || height <= 0.001) continue;

    const normRect: AnnotationRect = {
      x1,
      y1,
      x2: clamp01(x1 + width),
      y2: clamp01(y1 + height),
      width,
      height,
    };

    const existing = rawByPage.get(owner.pageNum);
    if (existing) {
      existing.rects.push(normRect);
    } else {
      rawByPage.set(owner.pageNum, { page: owner, rects: [normRect] });
    }
  }

  const sortedEntries = Array.from(rawByPage.entries()).sort(
    ([a], [b]) => a - b,
  );
  const isMultiPage = sortedEntries.length > 1;

  return sortedEntries
    .map(([pageNum, entry]) => {
      const coalesced = coalesceAndNormalizeTextRects(entry.rects);
      const canonicalRects = coalesced.map((r) =>
        rotateRectToCanonical(r, rotation),
      );
      const rawSegmentText = isMultiPage
        ? extractTextForPageInRange(range, entry.page.el) || fullText
        : fullText;
      const segmentText = normalizePdfSelectionText(rawSegmentText);
      return {
        pageNum,
        text: segmentText,
        rects: canonicalRects,
      };
    })
    .filter((seg) => seg.rects.length > 0);
}

export interface PdfTextTokenGeometry {
  str: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fontFamily?: string;
  isItalic?: boolean;
}

export interface PdfLinkRectGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  url?: string;
  dest?: unknown;
}

export interface PdfPageHoverGeometry {
  links: PdfLinkRectGeometry[];
  textItems: PdfTextTokenGeometry[];
}

export interface PdfViewportLike {
  width: number;
  height: number;
  convertToViewportRectangle: (rect: number[]) => number[];
}

export interface PdfPageProxyLike {
  rotate?: number;
  getViewport: (params: { scale: number; rotation?: number }) => PdfViewportLike;
  getTextContent: () => Promise<{
    items: Array<unknown>;
    styles?: Record<string, { fontFamily?: string }>;
  }>;
  getAnnotations?: () => Promise<Array<unknown>>;
}

function pdfRectToNormalizedBox(
  pdfRect: number[],
  viewport: PdfViewportLike,
): PdfLinkRectGeometry | null {
  if (pdfRect.length < 4 || pdfRect.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const transformed = viewport.convertToViewportRectangle(pdfRect);
  if (
    !Array.isArray(transformed) ||
    transformed.length < 4 ||
    transformed.some((n) => !Number.isFinite(n))
  ) {
    return null;
  }
  const [vx1, vy1, vx2, vy2] = transformed;
  const x1 = clamp01(Math.min(vx1, vx2) / viewport.width);
  const x2 = clamp01(Math.max(vx1, vx2) / viewport.width);
  const y1 = clamp01(Math.min(vy1, vy2) / viewport.height);
  const y2 = clamp01(Math.max(vy1, vy2) / viewport.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
}

/**
 * Extracts normalized [0, 1] link annotations and glyph-level text run boxes
 * directly from a PDF.js page proxy using the exact PDF viewport transform.
 */
export async function extractPdfPageHoverGeometry(
  page: PdfPageProxyLike,
  rotation?: number,
): Promise<PdfPageHoverGeometry> {
  const effectiveRotation =
    rotation !== undefined
      ? normalizePageRotation(rotation)
      : normalizePageRotation(page.rotate);
  const viewport = page.getViewport({ scale: 1, rotation: effectiveRotation });
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    return { links: [], textItems: [] };
  }

  const [textContent, rawAnnotations] = await Promise.all([
    page.getTextContent().catch(() => ({ items: [] as Array<unknown> })),
    typeof page.getAnnotations === 'function'
      ? page.getAnnotations().catch(() => [] as Array<unknown>)
      : Promise.resolve([] as Array<unknown>),
  ]);

  const links: PdfLinkRectGeometry[] = [];
  if (Array.isArray(rawAnnotations)) {
    for (const rawAnnot of rawAnnotations) {
      if (!rawAnnot || typeof rawAnnot !== 'object') continue;
      const annot = rawAnnot as {
        subtype?: unknown;
        rect?: unknown;
        url?: unknown;
        unsafeUrl?: unknown;
        dest?: unknown;
      };
      if (
        typeof annot.subtype !== 'string' ||
        annot.subtype.toLowerCase() !== 'link' ||
        !Array.isArray(annot.rect) ||
        annot.rect.length < 4
      ) {
        continue;
      }
      const nums = annot.rect.slice(0, 4).map(Number);
      const box = pdfRectToNormalizedBox(nums, viewport);
      if (box) {
        const rawUrl =
          typeof annot.url === 'string' && annot.url
            ? annot.url
            : typeof annot.unsafeUrl === 'string' && annot.unsafeUrl
              ? annot.unsafeUrl
              : undefined;
        links.push({
          ...box,
          ...(rawUrl ? { url: rawUrl } : {}),
          ...(annot.dest !== undefined && annot.dest !== null ? { dest: annot.dest } : {}),
        });
      }
    }
  }

  const textItems: PdfTextTokenGeometry[] = [];
  const styles =
    textContent &&
    typeof textContent === 'object' &&
    'styles' in textContent &&
    textContent.styles &&
    typeof textContent.styles === 'object'
      ? (textContent.styles as Record<string, { fontFamily?: string } | undefined>)
      : undefined;
  const rawItems = Array.isArray(textContent?.items) ? textContent.items : [];
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
      height?: unknown;
      fontName?: unknown;
    };
    if (
      typeof item.str !== 'string' ||
      !item.str ||
      typeof item.width !== 'number' ||
      item.width <= 0 ||
      !Array.isArray(item.transform) ||
      item.transform.length < 6
    ) {
      continue;
    }
    const transform = item.transform.map(Number);
    if (transform.some((n) => !Number.isFinite(n))) continue;
    const [a, b, c, d, tx, ty] = transform;
    const rawH =
      typeof item.height === 'number' && item.height > 0
        ? item.height
        : Math.hypot(c, d) || Math.hypot(a, b) || 10;
    if (rawH <= 0) continue;

    const pdfUserBox = [tx, ty - rawH * 0.18, tx + item.width, ty + rawH * 0.80];
    const box = pdfRectToNormalizedBox(pdfUserBox, viewport);
    if (box) {
      const fontName = typeof item.fontName === 'string' ? item.fontName : '';
      const styleEntry = fontName && styles ? styles[fontName] : undefined;
      const fontFamily =
        typeof styleEntry?.fontFamily === 'string' && styleEntry.fontFamily.trim()
          ? styleEntry.fontFamily.trim()
          : undefined;
      const isItalic =
        Math.abs(c) > 0.01 ||
        /(?:italic|oblique)/i.test(fontName) ||
        (fontFamily ? /(?:italic|oblique)/i.test(fontFamily) : false);
      textItems.push({
        str: item.str,
        ...box,
        ...(fontFamily ? { fontFamily } : {}),
        ...(isItalic ? { isItalic } : {}),
      });
    }
  }

  return { links, textItems };
}

let cachedHoverMeasureCtx: CanvasRenderingContext2D | null | undefined;

export function measureProportionalSubstringRatios(
  str: string,
  subStart: number,
  subEnd: number,
  fontFamily?: string,
  isItalic?: boolean,
): [number, number] | null {
  if (typeof document === 'undefined') return null;
  if (cachedHoverMeasureCtx === undefined) {
    try {
      const canvas = document.createElement('canvas');
      cachedHoverMeasureCtx = canvas.getContext('2d');
    } catch {
      cachedHoverMeasureCtx = null;
    }
  }
  const ctx = cachedHoverMeasureCtx;
  if (!ctx) return null;

  ctx.font = `${isItalic ? 'italic ' : ''}12px ${fontFamily || 'serif'}`;
  const fullWidth = ctx.measureText(str).width;
  if (!Number.isFinite(fullWidth) || fullWidth <= 0) return null;

  const prefixWidth = subStart > 0 ? ctx.measureText(str.slice(0, subStart)).width : 0;
  const uptoEndWidth =
    subEnd < str.length ? ctx.measureText(str.slice(0, subEnd)).width : fullWidth;
  if (!Number.isFinite(prefixWidth) || !Number.isFinite(uptoEndWidth)) return null;

  const r0 = Math.max(0, Math.min(1, prefixWidth / fullWidth));
  const r1 = Math.max(r0, Math.min(1, uptoEndWidth / fullWidth));
  return [r0, r1];
}

function pointToBoxDistanceSq(
  px: number,
  py: number,
  box: { x1: number; y1: number; x2: number; y2: number },
): number {
  const dx = px < box.x1 ? box.x1 - px : px > box.x2 ? px - box.x2 : 0;
  const dy = py < box.y1 ? box.y1 - py : py > box.y2 ? py - box.y2 : 0;
  return dx * dx + dy * dy;
}

/**
 * Resolves exact client coordinates for a matched citation/figure token from
 * extracted PDF geometry (`/Link` rectangles first, then PDF `TextItem` interpolation).
 */
export function resolveExactHoverRectFromPdfGeometry(params: {
  pointerNormX: number;
  pointerNormY: number;
  spanText: string;
  matchStart: number;
  matchEnd: number;
  pageRect: { left: number; top: number; width: number; height: number };
  geometry: PdfPageHoverGeometry;
  rotation?: number;
}): { left: number; top: number; width: number; height: number } | null {
  const {
    pointerNormX,
    pointerNormY,
    spanText,
    matchStart,
    matchEnd,
    pageRect,
    geometry,
    rotation = 0,
  } = params;

  if (pageRect.width <= 0 || pageRect.height <= 0) return null;

  const toClientRect = (box: PdfLinkRectGeometry) => ({
    left: pageRect.left + box.x1 * pageRect.width,
    top: pageRect.top + box.y1 * pageRect.height,
    width: (box.x2 - box.x1) * pageRect.width,
    height: (box.y2 - box.y1) * pageRect.height,
  });

  // 1. Prefer compact /Link annotation rectangle directly under the pointer
  let bestLink: PdfLinkRectGeometry | null = null;
  let bestLinkArea = Infinity;
  const linkTol = 0.003;
  for (const link of geometry.links) {
    const w = link.x2 - link.x1;
    const h = link.y2 - link.y1;
    if (w <= 0 || h <= 0 || w > 0.45 || h > 0.12) continue;
    if (
      pointerNormX >= link.x1 - linkTol &&
      pointerNormX <= link.x2 + linkTol &&
      pointerNormY >= link.y1 - linkTol &&
      pointerNormY <= link.y2 + linkTol
    ) {
      const area = w * h;
      if (area < bestLinkArea) {
        bestLinkArea = area;
        bestLink = link;
      }
    }
  }
  if (bestLink) {
    return toClientRect(bestLink);
  }

  // 2. Fallback to nearest PDF TextItem containing the matched token / spanText
  const matchedToken = spanText.slice(matchStart, matchEnd);
  if (!matchedToken) return null;

  let bestItem: PdfTextTokenGeometry | null = null;
  let bestScore = Infinity;
  let bestIsExact = false;

  for (const item of geometry.textItems) {
    const isExact = item.str === spanText;
    if (!isExact && !item.str.includes(matchedToken)) continue;

    const distSq = pointToBoxDistanceSq(pointerNormX, pointerNormY, item);
    if (
      isExact !== bestIsExact
        ? isExact && distSq <= 0.0025
        : distSq < bestScore
    ) {
      bestIsExact = isExact;
      bestScore = distSq;
      bestItem = item;
    }
  }

  if (!bestItem || bestScore > 0.01) return null;

  const totalLen = bestItem.str.length;
  if (totalLen <= 0) return null;

  let subStart = matchStart;
  let subEnd = matchEnd;
  if (bestItem.str !== spanText) {
    const idx = bestItem.str.indexOf(matchedToken);
    if (idx === -1) return null;
    subStart = idx;
    subEnd = idx + matchedToken.length;
  }

  const measured = measureProportionalSubstringRatios(
    bestItem.str,
    subStart,
    subEnd,
    bestItem.fontFamily,
    bestItem.isItalic,
  );
  const r0 = measured ? measured[0] : Math.max(0, Math.min(1, subStart / totalLen));
  const r1 = measured ? measured[1] : Math.max(r0, Math.min(1, subEnd / totalLen));
  const normRot = normalizePageRotation(rotation);

  let box: PdfLinkRectGeometry;
  if (normRot === 90) {
    const h = bestItem.y2 - bestItem.y1;
    box = {
      x1: bestItem.x1,
      x2: bestItem.x2,
      y1: bestItem.y1 + h * r0,
      y2: bestItem.y1 + h * r1,
    };
  } else if (normRot === 180) {
    const w = bestItem.x2 - bestItem.x1;
    box = {
      x1: bestItem.x2 - w * r1,
      x2: bestItem.x2 - w * r0,
      y1: bestItem.y1,
      y2: bestItem.y2,
    };
  } else if (normRot === 270) {
    const h = bestItem.y2 - bestItem.y1;
    box = {
      x1: bestItem.x1,
      x2: bestItem.x2,
      y1: bestItem.y2 - h * r1,
      y2: bestItem.y2 - h * r0,
    };
  } else {
    const w = bestItem.x2 - bestItem.x1;
    box = {
      x1: bestItem.x1 + w * r0,
      x2: bestItem.x1 + w * r1,
      y1: bestItem.y1,
      y2: bestItem.y2,
    };
  }

  if (box.x2 <= box.x1 || box.y2 <= box.y1) return null;
  return toClientRect(box);
}
