import { describe, it, expect } from 'vitest';
import { PdfAnnotationEngine } from '@/features/workspaces/library/utils/reader.util';
import type { ReaderAnnotation, AnnotationRect } from '@/features/workspaces/library/types/reader.types';

describe('PdfAnnotationEngine Deep Module', () => {
  const annotations: ReaderAnnotation[] = [
    {
      id: 'a1',
      paperId: 'paper-1',
      pageNumber: 2,
      type: 'highlight',
      rects: [{ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.55, width: 0.8, height: 0.05 }],
      text: 'Second page lower highlight',
      color: 'yellow',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'a2',
      paperId: 'paper-1',
      pageNumber: 1,
      type: 'highlight',
      rects: [{ x1: 0.1, y1: 0.8, x2: 0.9, y2: 0.85, width: 0.8, height: 0.05 }],
      text: 'First page bottom highlight',
      color: 'green',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'a3',
      paperId: 'paper-1',
      pageNumber: 1,
      type: 'highlight',
      rects: [{ x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.25, width: 0.8, height: 0.05 }],
      text: 'First page top highlight',
      color: 'blue',
      comment: 'Key finding on methodology',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('sorts annotations in natural top-to-bottom reading order across pages', () => {
    const sorted = PdfAnnotationEngine.sortAnnotations(annotations);
    expect(sorted[0].id).toBe('a3'); // Page 1, y1: 0.2
    expect(sorted[1].id).toBe('a2'); // Page 1, y1: 0.8
    expect(sorted[2].id).toBe('a1'); // Page 2, y1: 0.5
  });

  it('filters annotations by search text and comments', () => {
    const res1 = PdfAnnotationEngine.filterAnnotations(annotations, 'methodology');
    expect(res1).toHaveLength(1);
    expect(res1[0].id).toBe('a3');

    const res2 = PdfAnnotationEngine.filterAnnotations(annotations, 'bottom');
    expect(res2).toHaveLength(1);
    expect(res2[0].id).toBe('a2');
  });

  it('normalizes bounding rectangles within relative [0, 1] viewport bounds', () => {
    const outOfBoundsRect: AnnotationRect = { x1: -0.1, y1: 1.2, x2: 1.5, y2: 1.8, width: 1.6, height: 0.6 };
    const normalized = PdfAnnotationEngine.normalizeRect(outOfBoundsRect);

    expect(normalized.x1).toBe(0);
    expect(normalized.y1).toBe(1);
    expect(normalized.x2).toBe(1);
    expect(normalized.y2).toBe(1);
  });

  it('resolves color styles with sensible defaults', () => {
    const yellowConfig = PdfAnnotationEngine.getColorConfig('yellow');
    expect(yellowConfig.border).toBe('#eab308');

    const fallbackConfig = PdfAnnotationEngine.getColorConfig('non-existent-color');
    expect(fallbackConfig.border).toBe('#eab308');
  });
});
