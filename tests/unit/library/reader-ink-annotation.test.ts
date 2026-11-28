// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  normalizePagePoint,
  denormalizePagePoint,
  calculatePointsBoundingBox,
  simplifyPointsRdp,
  smoothPointsToSvgPath,
  type NormalizedPoint,
} from '@/features/library/domain/reader/ink-canvas';
import { isUuidV7, uuidv7 } from '@/shared/utils/uuid.util';

describe('PDF Native Annotation & Canvas Drawing Engine (Phân hệ 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Coordinate Normalization & Denormalization', () => {
    it('normalizes viewport pixel coordinates to strictly clamped [0.0, 1.0]', () => {
      const pageRect = { left: 100, top: 200, width: 800, height: 1000 };

      // Center point
      const center = normalizePagePoint(500, 700, pageRect);
      expect(center.x).toBe(0.5);
      expect(center.y).toBe(0.5);

      // Top-left
      const topLeft = normalizePagePoint(100, 200, pageRect);
      expect(topLeft.x).toBe(0);
      expect(topLeft.y).toBe(0);

      // Bottom-right
      const bottomRight = normalizePagePoint(900, 1200, pageRect);
      expect(bottomRight.x).toBe(1);
      expect(bottomRight.y).toBe(1);

      // Out of bounds (negative / past right) clamps strictly
      const outOfBounds = normalizePagePoint(-50, 1500, pageRect);
      expect(outOfBounds.x).toBe(0);
      expect(outOfBounds.y).toBe(1);
    });

    it('denormalizes [0.0, 1.0] back to physical pixel coordinates accurately', () => {
      const pageRect = { width: 600, height: 900 };
      const point: NormalizedPoint = { x: 0.25, y: 0.75 };

      const { px, py } = denormalizePagePoint(point, pageRect);
      expect(px).toBe(150);
      expect(py).toBe(675);
    });

    it('handles zero or collapsed page bounds gracefully without NaN', () => {
      const zeroRect = { left: 0, top: 0, width: 0, height: 0 };
      const res = normalizePagePoint(100, 100, zeroRect);
      expect(res.x).toBe(0);
      expect(res.y).toBe(0);
      expect(Number.isNaN(res.x)).toBe(false);
    });
  });

  describe('2. Bounding Box & Vector Calculations', () => {
    it('calculates tight bounding box with padding around drawn points', () => {
      const points: NormalizedPoint[] = [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.5 },
        { x: 0.2, y: 0.4 },
        { x: 0.4, y: 0.6 },
      ];

      const box = calculatePointsBoundingBox(points, 0.01);
      expect(box.x1).toBe(0.09); // minX (0.1) - 0.01
      expect(box.y1).toBe(0.19); // minY (0.2) - 0.01
      expect(box.x2).toBe(0.41); // maxX (0.4) + 0.01
      expect(box.y2).toBe(0.61); // maxY (0.6) + 0.01
      expect(box.width).toBeCloseTo(0.32, 2);
      expect(box.height).toBeCloseTo(0.42, 2);
    });

    it('enforces minimum width and height for tiny or single-point clicks', () => {
      const singlePoint: NormalizedPoint[] = [{ x: 0.5, y: 0.5 }];
      const box = calculatePointsBoundingBox(singlePoint, 0.001);
      expect(box.width).toBeGreaterThanOrEqual(0.01);
      expect(box.height).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('3. Ramer-Douglas-Peucker Point Simplification', () => {
    it('simplifies collinear micro-jitter points while preserving curve endpoints', () => {
      // 5 collinear points on line y = x
      const straightLine: NormalizedPoint[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2001 }, // micro jitter
        { x: 0.3, y: 0.2999 }, // micro jitter
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.5 },
      ];

      const simplified = simplifyPointsRdp(straightLine, 0.001);
      // Collinear intermediate points should be removed
      expect(simplified.length).toBeLessThan(straightLine.length);
      expect(simplified[0]).toEqual(straightLine[0]);
      expect(simplified[simplified.length - 1]).toEqual(straightLine[straightLine.length - 1]);
    });

    it('preserves sharp corners and extrema in curve', () => {
      // V-shaped curve
      const vCurve: NormalizedPoint[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.3 },
        { x: 0.3, y: 0.5 }, // Peak corner
        { x: 0.4, y: 0.3 },
        { x: 0.5, y: 0.1 },
      ];

      const simplified = simplifyPointsRdp(vCurve, 0.01);
      // Corner at (0.3, 0.5) must be preserved
      expect(simplified.some((p) => p.x === 0.3 && p.y === 0.5)).toBe(true);
    });
  });

  describe('4. Quadratic Bézier Midpoint Spline Smoothing', () => {
    it('generates smooth Bézier curve commands (M, Q, L) instead of jagged lines', () => {
      const points: NormalizedPoint[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.3 },
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.4 },
      ];

      const path = smoothPointsToSvgPath(points);

      // Must start with M (MoveTo)
      expect(path.startsWith('M ')).toBe(true);
      // Must contain Q (Quadratic Bézier curve) for smooth interpolation
      expect(path.includes(' Q ')).toBe(true);
      // Must terminate cleanly with L (LineTo)
      expect(path.includes(' L ')).toBe(true);
    });

    it('scales coordinates relative to bounding box when relativeBox is provided', () => {
      const points: NormalizedPoint[] = [
        { x: 0.1, y: 0.2 },
        { x: 0.2, y: 0.4 },
        { x: 0.3, y: 0.6 },
      ];

      const box = { x1: 0.1, y1: 0.2, width: 0.2, height: 0.4 };
      const path = smoothPointsToSvgPath(points, box);

      // Start point at box origin should be scaled to (0.00, 0.00)
      expect(path.startsWith('M 0 0') || path.startsWith('M 0.00 0.00')).toBe(true);
      // End point at opposite corner should be scaled to (100.00, 100.00)
      expect(path.endsWith('100 100') || path.endsWith('100.00 100.00')).toBe(true);
    });
  });

  describe('5. UUIDv7 Generation for Annotation Mutations', () => {
    it('generates valid RFC 9562 UUIDv7 for annotation mutations', () => {
      const id = uuidv7();
      expect(isUuidV7(id)).toBe(true);
    });
  });
});
