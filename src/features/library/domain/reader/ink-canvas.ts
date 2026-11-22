/**
 * PDF Reader Freehand Ink & Canvas Vector Smoothing Engine
 * (`@/features/library/domain/reader-ink-canvas.domain`)
 *
 * Provides high-performance vector path generation, Ramer-Douglas-Peucker simplification,
 * Quadratic Bézier midpoint curve smoothing, and coordinate normalization (0.0 to 1.0)
 * for stylus, mouse, and touch drawing in the academic PDF reader.
 */

export interface NormalizedPoint {
  x: number; // 0.0 to 1.0 relative to page width
  y: number; // 0.0 to 1.0 relative to page height
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

/**
 * Normalizes client viewport coordinates relative to a page container rectangle.
 * Clamps result strictly within [0.0, 1.0].
 */
export function normalizePagePoint(
  clientX: number,
  clientY: number,
  pageRect: { left: number; top: number; width: number; height: number },
): NormalizedPoint {
  if (pageRect.width <= 0 || pageRect.height <= 0) {
    return { x: 0, y: 0 };
  }
  const rawX = (clientX - pageRect.left) / pageRect.width;
  const rawY = (clientY - pageRect.top) / pageRect.height;
  return {
    x: Math.max(0, Math.min(1, Number(rawX.toFixed(5)))),
    y: Math.max(0, Math.min(1, Number(rawY.toFixed(5)))),
  };
}

/**
 * Denormalizes relative [0.0, 1.0] coordinates back to pixel coordinates for canvas rendering.
 */
export function denormalizePagePoint(
  point: NormalizedPoint,
  pageRect: { width: number; height: number },
): { px: number; py: number } {
  return {
    px: point.x * pageRect.width,
    py: point.y * pageRect.height,
  };
}

/**
 * Computes a tight bounding box around a series of normalized points with configurable padding.
 */
export function calculatePointsBoundingBox(
  points: readonly NormalizedPoint[],
  padding = 0.005,
): BoundingBox {
  if (points.length === 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };
  }

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const x1 = Math.max(0, Number((minX - padding).toFixed(4)));
  const y1 = Math.max(0, Number((minY - padding).toFixed(4)));
  const x2 = Math.min(1, Number((maxX + padding).toFixed(4)));
  const y2 = Math.min(1, Number((maxY + padding).toFixed(4)));
  const width = Math.max(0.01, Number((x2 - x1).toFixed(4)));
  const height = Math.max(0.01, Number((y2 - y1).toFixed(4)));

  return { x1, y1, x2, y2, width, height };
}

/**
 * Distance from point P to line segment AB.
 */
function perpendicularDistance(
  p: NormalizedPoint,
  a: NormalizedPoint,
  b: NormalizedPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const distDx = p.x - a.x;
    const distDy = p.y - a.y;
    return Math.sqrt(distDx * distDx + distDy * distDy);
  }

  const cross = Math.abs((p.y - a.y) * dx - (p.x - a.x) * dy);
  return cross / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker simplification algorithm.
 * Removes redundant collinear micro-jitter points from pointer events
 * while preserving critical stroke features and curvature.
 */
export function simplifyPointsRdp(
  points: readonly NormalizedPoint[],
  tolerance = 0.0008,
): NormalizedPoint[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let index = 0;
  const lastIdx = points.length - 1;

  for (let i = 1; i < lastIdx; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[lastIdx]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const leftSegment = simplifyPointsRdp(points.slice(0, index + 1), tolerance);
    const rightSegment = simplifyPointsRdp(points.slice(index), tolerance);
    return [...leftSegment.slice(0, -1), ...rightSegment];
  }

  return [points[0], points[lastIdx]];
}

/**
 * Transforms a series of points into a smooth SVG path using Quadratic Bézier Midpoint Splining.
 *
 * If `relativeBox` is supplied, coordinates are mapped to [0, 100]% relative to that bounding box.
 * If omitted, coordinates are mapped to [0, 100]% relative to the full page.
 */
export function smoothPointsToSvgPath(
  points: readonly NormalizedPoint[],
  relativeBox?: { x1: number; y1: number; width: number; height: number },
): string {
  if (points.length === 0) return '';

  const w = relativeBox ? Math.max(0.001, relativeBox.width) : 1;
  const h = relativeBox ? Math.max(0.001, relativeBox.height) : 1;
  const ox = relativeBox ? relativeBox.x1 : 0;
  const oy = relativeBox ? relativeBox.y1 : 0;

  // Map to 0-100 percentage scale
  const scaled = points.map((p) => ({
    x: Number((((p.x - ox) / w) * 100).toFixed(2)),
    y: Number((((p.y - oy) / h) * 100).toFixed(2)),
  }));

  if (scaled.length === 1) {
    const pt = scaled[0];
    return `M ${pt.x} ${pt.y} L ${pt.x + 0.1} ${pt.y + 0.1}`;
  }

  if (scaled.length === 2) {
    return `M ${scaled[0].x} ${scaled[0].y} L ${scaled[1].x} ${scaled[1].y}`;
  }

  // Quadratic Bézier curve through midpoints
  let d = `M ${scaled[0].x} ${scaled[0].y}`;

  for (let i = 1; i < scaled.length - 1; i++) {
    const current = scaled[i];
    const next = scaled[i + 1];
    const midX = Number(((current.x + next.x) / 2).toFixed(2));
    const midY = Number(((current.y + next.y) / 2).toFixed(2));

    d += ` Q ${current.x} ${current.y}, ${midX} ${midY}`;
  }

  const last = scaled[scaled.length - 1];
  d += ` L ${last.x} ${last.y}`;

  return d;
}
