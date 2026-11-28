import { describe, it, expect } from 'vitest';
import {
  normalizePageRotation,
  normalizePdfSelectionText,
  rotatePointToCanonical,
  rotatePointFromCanonical,
  rotateRectToCanonical,
  rotateRectFromCanonical,
  coalesceHorizontalRects,
  splitVerticalOverlaps,
  coalesceAndNormalizeTextRects,
  extractSelectionSegmentsByPage,
  extractPdfPageHoverGeometry,
  resolveExactHoverRectFromPdfGeometry,
} from '@/features/library/domain/reader/annotation-geometry';
import {
  normalizePagePoint,
  denormalizePagePoint,
  calculatePointsBoundingBox,
  simplifyPointsRdp,
  smoothPointsToSvgPath,
  type NormalizedPoint,
} from '@/features/library/domain/reader/ink-canvas';
import type { AnnotationRect } from '@/features/library/types/reader.types';
import { AUTHOR_YEAR_CITATION_RE } from '@/features/library/ui/reader/viewer/ViewerSmartHover';

function makeDomRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({ left, top, width, height }),
  } as DOMRect;
}

describe('annotation-geometry domain', () => {
  describe('normalizePageRotation', () => {
    it('normalizes positive, negative, and multi-turn angles to quarter turns', () => {
      expect(normalizePageRotation(undefined)).toBe(0);
      expect(normalizePageRotation(0)).toBe(0);
      expect(normalizePageRotation(90)).toBe(90);
      expect(normalizePageRotation(180)).toBe(180);
      expect(normalizePageRotation(270)).toBe(270);
      expect(normalizePageRotation(360)).toBe(0);
      expect(normalizePageRotation(450)).toBe(90);
      expect(normalizePageRotation(-90)).toBe(270);
      expect(normalizePageRotation(-180)).toBe(180);
    });
  });

  describe('rotation round-trip invariance', () => {
    const rotations = [0, 90, 180, 270, -90, 450] as const;

    it('preserves points under rotatePointFromCanonical -> rotatePointToCanonical', () => {
      const canonical = { x: 0.23, y: 0.67 };
      for (const rot of rotations) {
        const rotated = rotatePointFromCanonical(canonical, rot);
        const restored = rotatePointToCanonical(rotated, rot);
        expect(restored.x).toBeCloseTo(canonical.x, 4);
        expect(restored.y).toBeCloseTo(canonical.y, 4);
      }
    });

    it('projects canonical rect to rotated viewport coordinates accurately at 90/180/270 deg', () => {
      const canonical: AnnotationRect = {
        x1: 0.1,
        y1: 0.2,
        x2: 0.4,
        y2: 0.35,
        width: 0.3,
        height: 0.15,
      };

      const rot90 = rotateRectFromCanonical(canonical, 90);
      expect(rot90.x1).toBeCloseTo(0.65, 4); // 1 - 0.35
      expect(rot90.x2).toBeCloseTo(0.8, 4);  // 1 - 0.2
      expect(rot90.y1).toBeCloseTo(0.1, 4);
      expect(rot90.y2).toBeCloseTo(0.4, 4);

      const rot180 = rotateRectFromCanonical(canonical, 180);
      expect(rot180.x1).toBeCloseTo(0.6, 4);
      expect(rot180.x2).toBeCloseTo(0.9, 4);
      expect(rot180.y1).toBeCloseTo(0.65, 4);
      expect(rot180.y2).toBeCloseTo(0.8, 4);

      const rot270 = rotateRectFromCanonical(canonical, 270);
      expect(rot270.x1).toBeCloseTo(0.2, 4);
      expect(rot270.x2).toBeCloseTo(0.35, 4);
      expect(rot270.y1).toBeCloseTo(0.6, 4);
      expect(rot270.y2).toBeCloseTo(0.9, 4);
    });

    it('round-trips rects identically and preserves paths & imageDataUrl metadata', () => {
      const canonical: AnnotationRect = {
        x1: 0.1234,
        y1: 0.2345,
        x2: 0.5678,
        y2: 0.4123,
        width: 0.4444,
        height: 0.1778,
        paths: ['M 0 0 L 100 100'],
        imageDataUrl: 'data:image/png;base64,abc',
      };

      for (const rot of rotations) {
        const viewport = rotateRectFromCanonical(canonical, rot);
        const restored = rotateRectToCanonical(viewport, rot);
        expect(restored.x1).toBeCloseTo(canonical.x1, 4);
        expect(restored.y1).toBeCloseTo(canonical.y1, 4);
        expect(restored.x2).toBeCloseTo(canonical.x2, 4);
        expect(restored.y2).toBeCloseTo(canonical.y2, 4);
        expect(restored.width).toBeCloseTo(canonical.width!, 4);
        expect(restored.height).toBeCloseTo(canonical.height!, 4);
        expect(restored.paths).toEqual(canonical.paths);
        expect(restored.imageDataUrl).toBe(canonical.imageDataUrl);
      }
    });
  });

  describe('coalesceHorizontalRects', () => {
    it('merges fragmented spans on the same line while preserving 2-column gutters', () => {
      const fragmented: AnnotationRect[] = [
        // Left column line 1 in 3 jittered word fragments
        { x1: 0.08, y1: 0.2, x2: 0.18, y2: 0.22, width: 0.1, height: 0.02 },
        // Right column line 1 sitting at slightly lower y1 (interleaved by y1 sort)
        { x1: 0.54, y1: 0.2005, x2: 0.72, y2: 0.2205, width: 0.18, height: 0.02 },
        { x1: 0.185, y1: 0.201, x2: 0.31, y2: 0.221, width: 0.125, height: 0.02 },
        { x1: 0.314, y1: 0.2, x2: 0.46, y2: 0.22, width: 0.146, height: 0.02 },
        // Right column second fragment
        { x1: 0.725, y1: 0.2005, x2: 0.91, y2: 0.2205, width: 0.185, height: 0.02 },
      ];

      const coalesced = coalesceHorizontalRects(fragmented);
      expect(coalesced).toHaveLength(2);
      expect(coalesced[0]).toMatchObject({ x1: 0.08, x2: 0.46 });
      expect(coalesced[1]).toMatchObject({ x1: 0.54, x2: 0.91 });
    });
  });

  describe('splitVerticalOverlaps', () => {
    it('splits overlapping lines in the same column without disturbing adjacent columns', () => {
      const rects: AnnotationRect[] = [
        { x1: 0.08, y1: 0.2, x2: 0.46, y2: 0.224, width: 0.38, height: 0.024 },
        { x1: 0.54, y1: 0.2, x2: 0.92, y2: 0.224, width: 0.38, height: 0.024 },
        { x1: 0.08, y1: 0.22, x2: 0.46, y2: 0.244, width: 0.38, height: 0.024 },
        { x1: 0.54, y1: 0.22, x2: 0.92, y2: 0.244, width: 0.38, height: 0.024 },
      ];

      const split = splitVerticalOverlaps(rects);
      expect(split).toHaveLength(4);
      // Left column line 1 and line 2 meet at midpoint (0.224 + 0.22) / 2 = 0.222
      expect(split[0].y2).toBeCloseTo(0.222, 4);
      expect(split[2].y1).toBeCloseTo(0.222, 4);
      // Right column line 1 and line 2 also meet at 0.222
      expect(split[1].y2).toBeCloseTo(0.222, 4);
      expect(split[3].y1).toBeCloseTo(0.222, 4);
    });

    it('coalesceAndNormalizeTextRects merges line fragments then splits vertical seams cleanly', () => {
      const raw: AnnotationRect[] = [
        { x1: 0.1, y1: 0.1, x2: 0.25, y2: 0.125, width: 0.15, height: 0.025 },
        { x1: 0.255, y1: 0.1, x2: 0.5, y2: 0.125, width: 0.245, height: 0.025 },
        { x1: 0.1, y1: 0.121, x2: 0.4, y2: 0.145, width: 0.3, height: 0.024 },
      ];

      const result = coalesceAndNormalizeTextRects(raw);
      expect(result).toHaveLength(2);
      expect(result[0].x1).toBeCloseTo(0.1, 4);
      expect(result[0].x2).toBeCloseTo(0.5, 4);
      expect(result[0].y2).toBeCloseTo(0.123, 4);
      expect(result[1].y1).toBeCloseTo(0.123, 4);
    });
  });

  describe('extractSelectionSegmentsByPage', () => {
    it('partitions a cross-page selection into per-page segments with sliced text and canonicalized rects', () => {
      const container = document.createElement('div');

      const page1 = document.createElement('div');
      page1.dataset.pageNum = '1';
      page1.getBoundingClientRect = () => makeDomRect(100, 0, 500, 1000);
      const p1Text = document.createElement('div');
      p1Text.className = 'react-pdf__Page__textContent';
      p1Text.textContent = 'prefix end of page one';
      page1.appendChild(p1Text);

      const page2 = document.createElement('div');
      page2.dataset.pageNum = '2';
      page2.getBoundingClientRect = () => makeDomRect(100, 1020, 500, 1000);
      const p2Text = document.createElement('div');
      p2Text.className = 'react-pdf__Page__textContent';
      p2Text.textContent = 'start of page two suffix';
      page2.appendChild(p2Text);

      container.appendChild(page1);
      container.appendChild(page2);

      const range = document.createRange();
      range.setStart(p1Text.firstChild!, 7); // "end of page one"
      range.setEnd(p2Text.firstChild!, 17);  // "start of page two"

      const clientRects = [
        // Two fragments on bottom of page 1
        makeDomRect(150, 950, 120, 20),
        makeDomRect(272, 950, 130, 20),
        // One fragment on top of page 2
        makeDomRect(150, 1050, 220, 20),
      ];
      range.getClientRects = () => clientRects as unknown as DOMRectList;
      range.getBoundingClientRect = () => makeDomRect(150, 950, 252, 120);

      const segments = extractSelectionSegmentsByPage(
        range,
        container,
        'end of page one start of page two',
        1,
        90,
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].pageNum).toBe(1);
      expect(segments[0].text).toBe('end of page one');
      expect(segments[0].rects).toHaveLength(1);
      // Viewport rect on page 1: x=[0.1, 0.604], y=[0.95, 0.97]
      // Inverse 90deg -> canonical x=y=[0.95, 0.97], canonical y=1-x=[0.396, 0.9]
      expect(segments[0].rects[0].x1).toBeCloseTo(0.95, 4);
      expect(segments[0].rects[0].x2).toBeCloseTo(0.97, 4);
      expect(segments[0].rects[0].y1).toBeCloseTo(0.396, 4);
      expect(segments[0].rects[0].y2).toBeCloseTo(0.9, 4);

      expect(segments[1].pageNum).toBe(2);
      expect(segments[1].text).toBe('start of page two');
      expect(segments[1].rects).toHaveLength(1);
      // Viewport rect on page 2: x=[0.1, 0.54], y=[0.03, 0.05]
      // Inverse 90deg -> canonical x=[0.03, 0.05], y=[0.46, 0.9]
      expect(segments[1].rects[0].x1).toBeCloseTo(0.03, 4);
      expect(segments[1].rects[0].x2).toBeCloseTo(0.05, 4);
      expect(segments[1].rects[0].y1).toBeCloseTo(0.46, 4);
      expect(segments[1].rects[0].y2).toBeCloseTo(0.9, 4);
    });
  });

  describe('normalizePdfSelectionText', () => {
    it('de-hyphenates line-wrapped PDF splits while keeping genuine intra-line hyphens intact', () => {
      expect(normalizePdfSelectionText('  relative im-\nprovement on\n\nCOCO  ')).toBe(
        'relative improvement on COCO',
      );
      expect(normalizePdfSelectionText('relative im- provement with state-of-the-art')).toBe(
        'relative improvement with state-of-the-art',
      );
    });
  });

  describe('extractPdfPageHoverGeometry & resolveExactHoverRectFromPdfGeometry', () => {
    it('extracts normalized /Link and TextItem geometries and resolves /Link rect before TextItem', async () => {
      const mockPage = {
        rotate: 0,
        getViewport: ({ scale }: { scale: number; rotation?: number }) => ({
          width: 600 * scale,
          height: 800 * scale,
          // Simulate standard PDF bottom-up Y -> viewport top-down Y conversion
          convertToViewportRectangle: ([x1, y1, x2, y2]: number[]) => [
            x1 * scale,
            (800 - y2) * scale,
            x2 * scale,
            (800 - y1) * scale,
          ],
        }),
        getTextContent: async () => ({
          items: [
            {
              str: 'VGG nets [40] but still',
              transform: [10, 0, -2, 10, 100, 600],
              width: 120,
              height: 10,
            },
            {
              // Non-link text item on another line
              str: 'shown in Fig. 1 below',
              transform: [10, 0, 0, 10, 100, 500],
              width: 100,
              height: 10,
            },
          ],
        }),
        getAnnotations: async () => [
          { subtype: 'Link', rect: [154, 597, 174, 610] },
          { subtype: 'Text', rect: [0, 0, 600, 800] }, // ignored (not Link)
        ],
      };

      const geometry = await extractPdfPageHoverGeometry(mockPage, 0);
      expect(geometry.links).toHaveLength(1);
      expect(geometry.links[0].x1).toBeCloseTo(154 / 600, 4);
      expect(geometry.links[0].x2).toBeCloseTo(174 / 600, 4);
      expect(geometry.textItems).toHaveLength(2);

      const pageRect = { left: 50, top: 100, width: 600, height: 800 };

      // Pointer inside /Link rect for [40] resolves directly to /Link geometry
      const linkHit = resolveExactHoverRectFromPdfGeometry({
        pointerNormX: 164 / 600,
        pointerNormY: (800 - 604) / 800,
        spanText: 'VGG nets [40] but still',
        matchStart: 9,
        matchEnd: 13,
        pageRect,
        geometry,
      });
      expect(linkHit).not.toBeNull();
      expect(linkHit!.left).toBeCloseTo(50 + 154, 1);
      expect(linkHit!.width).toBeCloseTo(20, 1);

      // Pointer over Fig. 1 (no /Link) interpolates substring proportionally within PDF TextItem
      const figSpan = 'shown in Fig. 1 below'; // 21 chars; "Fig. 1" is indices 9..15
      const textHit = resolveExactHoverRectFromPdfGeometry({
        pointerNormX: (100 + (12 / 21) * 100) / 600,
        pointerNormY: (800 - 504) / 800,
        spanText: figSpan,
        matchStart: 9,
        matchEnd: 15,
        pageRect,
        geometry,
      });
      expect(textHit).not.toBeNull();
      expect(textHit!.left).toBeCloseTo(50 + 100 + (9 / 21) * 100, 1);
      expect(textHit!.width).toBeCloseTo((6 / 21) * 100, 1);
    });
  });

  describe('AUTHOR_YEAR_CITATION_RE', () => {
    it('matches APA, ICLR, NeurIPS, and disambiguated author-year citations', () => {
      const sample = [
        'recent advances in deep learning (Deng et al., 2013; Krizhevsky et al., 2012;',
        'Hinton & Salakhutdinov, 2006; Hinton et al., 2012a; Graves et al., 2013).',
        'such as dropout (Hinton et al., 2012b) regularization,',
        'residual nets (He et al., 2016), Kingma and Ba (2015), and Tu, 2014.',
      ].join(' ');

      const matches = Array.from(
        sample.matchAll(new RegExp(AUTHOR_YEAR_CITATION_RE.source, 'gu')),
      ).map((m) => ({
        badge: m[0].replace(/[()]/g, '').trim(),
        surname: m[1],
        coAuthor: m[2] ?? null,
        yearToken: m[3],
      }));

      expect(matches).toEqual([
        { badge: 'Deng et al., 2013', surname: 'Deng', coAuthor: null, yearToken: '2013' },
        { badge: 'Krizhevsky et al., 2012', surname: 'Krizhevsky', coAuthor: null, yearToken: '2012' },
        { badge: 'Hinton & Salakhutdinov, 2006', surname: 'Hinton', coAuthor: 'Salakhutdinov', yearToken: '2006' },
        { badge: 'Hinton et al., 2012a', surname: 'Hinton', coAuthor: null, yearToken: '2012a' },
        { badge: 'Graves et al., 2013', surname: 'Graves', coAuthor: null, yearToken: '2013' },
        { badge: 'Hinton et al., 2012b', surname: 'Hinton', coAuthor: null, yearToken: '2012b' },
        { badge: 'He et al., 2016', surname: 'He', coAuthor: null, yearToken: '2016' },
        { badge: 'Kingma and Ba 2015', surname: 'Kingma', coAuthor: 'Ba', yearToken: '2015' },
        { badge: 'Tu, 2014', surname: 'Tu', coAuthor: null, yearToken: '2014' },
      ]);
    });

    it('ignores lowercase fragments and prose with non-publication numbers', () => {
      const prose = 'deng et al., 2013; Batch 1850; Section 12; Model 1234; Alpha 20150.';
      const matches = Array.from(
        prose.matchAll(new RegExp(AUTHOR_YEAR_CITATION_RE.source, 'gu')),
      );
      expect(matches).toHaveLength(0);
    });
  });

  describe('ink-canvas vector normalization, RDP simplification & Bézier smoothing', () => {
    it('clamps normalized coordinates to [0, 1], denormalizes accurately, and handles collapsed bounds', () => {
      const pageRect = { left: 100, top: 200, width: 800, height: 1000 };
      expect(normalizePagePoint(500, 700, pageRect)).toEqual({ x: 0.5, y: 0.5 });
      expect(normalizePagePoint(-50, 1500, pageRect)).toEqual({ x: 0, y: 1 });
      expect(denormalizePagePoint({ x: 0.25, y: 0.75 }, { width: 600, height: 900 })).toEqual({
        px: 150,
        py: 675,
      });

      const zero = normalizePagePoint(100, 100, { left: 0, top: 0, width: 0, height: 0 });
      expect(zero).toEqual({ x: 0, y: 0 });
    });

    it('computes padded bounding boxes, simplifies micro-jitter via RDP, and generates smooth Bézier SVG paths', () => {
      const points: NormalizedPoint[] = [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.5 },
        { x: 0.2, y: 0.4 },
        { x: 0.4, y: 0.6 },
      ];
      const box = calculatePointsBoundingBox(points, 0.01);
      expect(box.x1).toBe(0.09);
      expect(box.y1).toBe(0.19);
      expect(box.x2).toBe(0.41);
      expect(box.y2).toBe(0.61);

      const singleBox = calculatePointsBoundingBox([{ x: 0.5, y: 0.5 }], 0.001);
      expect(singleBox.width).toBeGreaterThanOrEqual(0.01);
      expect(singleBox.height).toBeGreaterThanOrEqual(0.01);

      const jitteredLine: NormalizedPoint[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2001 },
        { x: 0.3, y: 0.2999 },
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.5 },
      ];
      const simplified = simplifyPointsRdp(jitteredLine, 0.001);
      expect(simplified.length).toBeLessThan(jitteredLine.length);

      const vCurve: NormalizedPoint[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.3 },
        { x: 0.3, y: 0.5 },
        { x: 0.4, y: 0.3 },
        { x: 0.5, y: 0.1 },
      ];
      expect(simplifyPointsRdp(vCurve, 0.01).some((p) => p.x === 0.3 && p.y === 0.5)).toBe(true);

      const path = smoothPointsToSvgPath(points);
      expect(path.startsWith('M ')).toBe(true);
      expect(path.includes(' Q ')).toBe(true);
      expect(path.includes(' L ')).toBe(true);

      const relPath = smoothPointsToSvgPath(
        [
          { x: 0.1, y: 0.2 },
          { x: 0.2, y: 0.4 },
          { x: 0.3, y: 0.6 },
        ],
        { x1: 0.1, y1: 0.2, width: 0.2, height: 0.4 },
      );
      expect(relPath.startsWith('M 0 0') || relPath.startsWith('M 0.00 0.00')).toBe(true);
      expect(relPath.endsWith('100 100') || relPath.endsWith('100.00 100.00')).toBe(true);
    });
  });
});
