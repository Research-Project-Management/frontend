/**
 * xy-cut.ts
 *
 * Recursive XY-Cut Algorithm for Multi-Column PDF Document Layout Analysis & Natural Reading Order Extraction.
 * Specifically optimized for academic and scientific papers (IEEE, ACM, Springer, arXiv, Nature).
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontName?: string;
  fontSize?: number;
  dir?: string;
}

export interface PdfBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfTextBlock {
  text: string;
  bbox: PdfBoundingBox;
  lines: string[];
  column?: number;
}

export interface XyCutOptions {
  pageWidth?: number;
  pageHeight?: number;
  minColumnGutter?: number;   // Minimum gap width (pt) to qualify as a vertical column split (default: 12)
  minLineGap?: number;        // Minimum gap height (pt) to qualify as a horizontal line split (default: 3)
  minParagraphGap?: number;   // Gap height (pt) to treat as a paragraph break (default: 6)
  maxRecursionDepth?: number; // Guard against stack overflow (default: 20)
}

export interface LayoutCutNode {
  type: 'horizontal' | 'vertical' | 'leaf';
  cutPosition?: number;
  bbox: PdfBoundingBox;
  first?: LayoutCutNode | null;  // Left or Top child
  second?: LayoutCutNode | null; // Right or Bottom child
  items: PdfTextItem[];
}

export interface ExtractedPageLayout {
  pageWidth: number;
  pageHeight: number;
  columnCount: number;
  blocks: PdfTextBlock[];
  fullText: string;
  orderedItems: PdfTextItem[];
}

export interface RawPdfTextContentItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  dir?: string;
}

/**
 * Normalizes raw PDF.js TextContent items into top-left coordinate space (pt).
 * In raw PDF coordinates, (0, 0) is at bottom-left, while screen/text layout uses top-left.
 */
export function extractTextItemsFromTextContent(
  textContent: { items: RawPdfTextContentItem[] },
  pageView?: number[] | { width: number; height: number },
): PdfTextItem[] {
  if (!textContent || !Array.isArray(textContent.items)) return [];

  let pageHeight = 842;
  if (Array.isArray(pageView) && pageView.length >= 4) {
    pageHeight = pageView[3] - pageView[1];
  } else if (pageView && typeof pageView === 'object' && 'height' in pageView) {
    pageHeight = pageView.height;
  }

  const result: PdfTextItem[] = [];

  let index = 0;
  for (const item of textContent.items) {
    const str = item.str || '';
    if (!str && !item.hasEOL) continue;

    const hasTransform = Array.isArray(item.transform) && item.transform.length >= 6;
    const transform: number[] = item.transform && item.transform.length >= 6 ? item.transform : [1, 0, 0, 1, 0, 0];
    const rawX = hasTransform ? (transform[4] ?? 0) : 0;
    const rawY = hasTransform ? (transform[5] ?? 0) : 0;
    const rawW = item.width || Math.max(str.length * 6, 8);
    const rawH = item.height || Math.abs(transform[0] ?? 10) || 10;

    // Convert from PDF coordinate system (origin bottom-left) to reading system (origin top-left)
    const x = Math.round(rawX);
    const y = hasTransform ? Math.round(pageHeight - rawY - rawH) : index * 16;
    const w = Math.round(rawW);
    const h = Math.round(rawH);

    result.push({
      str,
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.max(1, w),
      h: Math.max(1, h),
      fontName: item.fontName,
      fontSize: rawH,
      dir: item.dir,
    });
    index++;
  }

  return result;
}

/**
 * Coalesces fragmented inline text items that share the same baseline into single continuous lines.
 */
export function coalesceHorizontalFragments(
  items: PdfTextItem[],
  yTolerance: number = 3,
): PdfTextItem[] {
  if (items.length <= 1) return items.slice();

  // Sort by vertical position (Y), then horizontal position (X)
  const sorted = items.slice().sort((a, b) => {
    const dy = Math.abs(a.y - b.y);
    if (dy <= yTolerance) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const coalesced: PdfTextItem[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const isSameLine = Math.abs(current.y - next.y) <= yTolerance;
    const isAdjacent = next.x <= current.x + current.w + Math.max(current.h * 1.2, 10);

    if (isSameLine && isAdjacent) {
      const gap = next.x - (current.x + current.w);
      const space = gap > 2 && !current.str.endsWith(' ') && !next.str.startsWith(' ') ? ' ' : '';
      current.str = current.str + space + next.str;
      current.w = Math.max(current.w, next.x + next.w - current.x);
      current.h = Math.max(current.h, next.h);
    } else {
      coalesced.push(current);
      current = { ...next };
    }
  }

  coalesced.push(current);
  return coalesced;
}

/**
 * Calculates bounding box covering all items.
 */
export function computeBoundingBox(items: PdfTextItem[]): PdfBoundingBox {
  if (items.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.x + item.w > maxX) maxX = item.x + item.w;
    if (item.y + item.h > maxY) maxY = item.y + item.h;
  }

  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

/**
 * Identifies valleys (empty vertical or horizontal projections) within a bounding box.
 */
interface Valley {
  start: number;
  end: number;
  width: number;
  center: number;
}

function findProjectionValleys(
  items: PdfTextItem[],
  axis: 'x' | 'y',
  minCoord: number,
  maxCoord: number,
  minGap: number,
): Valley[] {
  if (items.length === 0 || maxCoord <= minCoord) return [];

  // Sort intervals along target axis
  const intervals: [number, number][] = items.map((it) => {
    return axis === 'x' ? [it.x, it.x + it.w] : [it.y, it.y + it.h];
  });

  // Merge overlapping intervals
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  let curr = intervals[0];

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next[0] <= curr[1]) {
      curr[1] = Math.max(curr[1], next[1]);
    } else {
      merged.push(curr);
      curr = next;
    }
  }
  merged.push(curr);

  // Find gaps between merged intervals within [minCoord, maxCoord]
  const valleys: Valley[] = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i][1];
    const gapEnd = merged[i + 1][0];
    const gapWidth = gapEnd - gapStart;

    if (gapWidth >= minGap) {
      valleys.push({
        start: gapStart,
        end: gapEnd,
        width: gapWidth,
        center: Math.round((gapStart + gapEnd) / 2),
      });
    }
  }

  return valleys;
}

/**
 * Recursive XY-Cut core algorithm.
 * Partitions boxes hierarchically by largest valleys along alternating or optimal axes.
 */
export function buildXyCutTree(
  items: PdfTextItem[],
  bounds: PdfBoundingBox,
  options: Required<XyCutOptions>,
  depth = 0,
): LayoutCutNode {
  if (items.length <= 1 || depth >= options.maxRecursionDepth) {
    return {
      type: 'leaf',
      bbox: bounds,
      items: items.slice().sort((a, b) => {
        const dy = a.y - b.y;
        return Math.abs(dy) > 3 ? dy : a.x - b.x;
      }),
    };
  }

  // 1. Try Vertical Cut First (Column Separator: finding prominent vertical valleys across X)
  const verticalValleys = findProjectionValleys(
    items,
    'x',
    bounds.x,
    bounds.x + bounds.w,
    options.minColumnGutter,
  );

  if (verticalValleys.length > 0) {
    // Pick the widest valley (column gutter)
    verticalValleys.sort((a, b) => b.width - a.width);
    const cut = verticalValleys[0];

    const leftItems: PdfTextItem[] = [];
    const rightItems: PdfTextItem[] = [];

    for (const item of items) {
      const centerX = item.x + item.w / 2;
      if (centerX <= cut.center) {
        leftItems.push(item);
      } else {
        rightItems.push(item);
      }
    }

    if (leftItems.length > 0 && rightItems.length > 0) {
      const leftBbox = computeBoundingBox(leftItems);
      const rightBbox = computeBoundingBox(rightItems);

      return {
        type: 'vertical',
        cutPosition: cut.center,
        bbox: bounds,
        first: buildXyCutTree(leftItems, leftBbox, options, depth + 1),   // Left Column first
        second: buildXyCutTree(rightItems, rightBbox, options, depth + 1), // Right Column second
        items: [],
      };
    }
  }

  // 2. Try Horizontal Cut (Paragraph / Section / Line Separator)
  const horizontalValleys = findProjectionValleys(
    items,
    'y',
    bounds.y,
    bounds.y + bounds.h,
    options.minLineGap,
  );

  if (horizontalValleys.length > 0) {
    // Check if there are full-width spanning items (e.g. paper title/abstract/wide figure)
    // mixed with narrower multi-column items. If so, prioritize the valley that separates
    // the spanning block from the multi-column region so the columns are not sliced in half.
    const midX = bounds.x + bounds.w / 2;
    const isSpanning = (it: PdfTextItem) =>
      it.w > bounds.w * 0.5 && it.x < midX - 20 && it.x + it.w > midX + 20;

    const hasSpanning = items.some(isSpanning);
    const hasColumnar = items.some((it) => !isSpanning(it));

    if (hasSpanning && hasColumnar) {
      const scoreValley = (v: Valley) => {
        const top = items.filter((it) => it.y + it.h / 2 <= v.center);
        const bottom = items.filter((it) => it.y + it.h / 2 > v.center);
        if (top.length === 0 || bottom.length === 0) return -1;
        const topPureColumnar = top.every((it) => !isSpanning(it));
        const bottomPureColumnar = bottom.every((it) => !isSpanning(it));
        // If one side becomes purely columnar (allowing an immediate vertical split next), boost it
        if (topPureColumnar !== bottomPureColumnar) {
          const columnarItems = topPureColumnar ? top : bottom;
          const spanningSideItems = topPureColumnar ? bottom : top;
          const pureSpanningIsolation = spanningSideItems.every(isSpanning) ? 100000 : 0;
          const colBounds = computeBoundingBox(columnarItems);
          const vValleys = findProjectionValleys(
            columnarItems,
            'x',
            colBounds.x,
            colBounds.x + colBounds.w,
            options.minColumnGutter,
          );
          if (vValleys.length > 0) {
            return 10000 + pureSpanningIsolation + columnarItems.length * 1000 + v.width;
          }
        }
        return v.width;
      };
      const valleyScores = new Map<Valley, number>();
      for (const v of horizontalValleys) {
        valleyScores.set(v, scoreValley(v));
      }
      horizontalValleys.sort((a, b) => (valleyScores.get(b) ?? 0) - (valleyScores.get(a) ?? 0));
    } else {
      // Pick the most prominent horizontal valley
      horizontalValleys.sort((a, b) => b.width - a.width);
    }
    const cut = horizontalValleys[0];

    const topItems: PdfTextItem[] = [];
    const bottomItems: PdfTextItem[] = [];

    for (const item of items) {
      const centerY = item.y + item.h / 2;
      if (centerY <= cut.center) {
        topItems.push(item);
      } else {
        bottomItems.push(item);
      }
    }

    if (topItems.length > 0 && bottomItems.length > 0) {
      const topBbox = computeBoundingBox(topItems);
      const bottomBbox = computeBoundingBox(bottomItems);

      return {
        type: 'horizontal',
        cutPosition: cut.center,
        bbox: bounds,
        first: buildXyCutTree(topItems, topBbox, options, depth + 1),   // Top Block first
        second: buildXyCutTree(bottomItems, bottomBbox, options, depth + 1), // Bottom Block second
        items: [],
      };
    }
  }

  // Base case: No cut can be made; treat as a cohesive leaf block
  return {
    type: 'leaf',
    bbox: bounds,
    items: items.slice().sort((a, b) => {
      const dy = a.y - b.y;
      return Math.abs(dy) > 3 ? dy : a.x - b.x;
    }),
  };
}

/**
 * Traverses the XY-Cut Tree depth-first according to natural reading order:
 * - Vertical cuts: Left child -> Right child
 * - Horizontal cuts: Top child -> Bottom child
 */
export function flattenXyCutTree(node: LayoutCutNode): PdfTextItem[] {
  if (node.type === 'leaf') {
    return node.items;
  }

  const result: PdfTextItem[] = [];
  const stack: LayoutCutNode[] = [node];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr.type === 'leaf') {
      for (let i = 0; i < curr.items.length; i++) {
        result.push(curr.items[i]);
      }
    } else {
      if (curr.second) stack.push(curr.second);
      if (curr.first) stack.push(curr.first);
    }
  }
  return result;
}

/**
 * Analyzes and partitions raw text items into human-readable structured blocks and text.
 */
export function performRecursiveXyCut(
  items: PdfTextItem[],
  options?: XyCutOptions,
): ExtractedPageLayout {
  const mergedOptions: Required<XyCutOptions> = {
    pageWidth: options?.pageWidth ?? 595,
    pageHeight: options?.pageHeight ?? 842,
    minColumnGutter: options?.minColumnGutter ?? 12,
    minLineGap: options?.minLineGap ?? 3,
    minParagraphGap: options?.minParagraphGap ?? 6,
    maxRecursionDepth: options?.maxRecursionDepth ?? 20,
  };

  if (!items || items.length === 0) {
    return {
      pageWidth: mergedOptions.pageWidth,
      pageHeight: mergedOptions.pageHeight,
      columnCount: 1,
      blocks: [],
      fullText: '',
      orderedItems: [],
    };
  }

  // Pre-process: Coalesce fragmented words on identical baselines
  const coalesced = coalesceHorizontalFragments(items);
  const bounds = computeBoundingBox(coalesced);

  // Build recursive XY-Cut Tree
  const root = buildXyCutTree(coalesced, bounds, mergedOptions, 0);

  // Flatten according to natural reading order
  const orderedItems = flattenXyCutTree(root);

  // Group into structured paragraphs/blocks
  const blocks: PdfTextBlock[] = [];
  let currentBlockLines: string[] = [];
  let currentBlockItems: PdfTextItem[] = [];

  for (let i = 0; i < orderedItems.length; i++) {
    const item = orderedItems[i];
    const prev = i > 0 ? orderedItems[i - 1] : null;

    if (prev) {
      const isNewColumnOrJump = Math.abs(item.x - prev.x) > 100 || item.y < prev.y - 20;
      const isParagraphBreak = item.y - (prev.y + prev.h) >= mergedOptions.minParagraphGap;

      if (isNewColumnOrJump || isParagraphBreak) {
        if (currentBlockLines.length > 0) {
          const bbox = computeBoundingBox(currentBlockItems);
          blocks.push({
            text: currentBlockLines.join('\n'),
            bbox,
            lines: currentBlockLines.slice(),
          });
          currentBlockLines = [];
          currentBlockItems = [];
        }
      }
    }

    currentBlockLines.push(item.str);
    currentBlockItems.push(item);
  }

  if (currentBlockLines.length > 0) {
    const bbox = computeBoundingBox(currentBlockItems);
    blocks.push({
      text: currentBlockLines.join('\n'),
      bbox,
      lines: currentBlockLines.slice(),
    });
  }

  // Detect column count based on presence of vertical cut nodes
  let columnCount = 1;
  function checkColumns(node: LayoutCutNode | null | undefined) {
    if (!node) return;
    if (node.type === 'vertical') {
      columnCount = Math.max(columnCount, 2);
    }
    checkColumns(node.first);
    checkColumns(node.second);
  }
  checkColumns(root);

  // Build formatted fullText
  const fullText = blocks.map((b) => b.text).join('\n\n');

  return {
    pageWidth: mergedOptions.pageWidth,
    pageHeight: mergedOptions.pageHeight,
    columnCount,
    blocks,
    fullText,
    orderedItems,
  };
}
