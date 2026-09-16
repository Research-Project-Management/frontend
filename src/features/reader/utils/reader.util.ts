import type { ReaderAnnotation, AnnotationRect, ReaderDocument, DocumentCreator } from '../types/reader.types';
import {
  generateCitationKey as libGenerateCitationKey,
} from '@/features/library/utils/bibtex.util';
import {
  normalizeAuthors as libNormalizeAuthors,
  cleanDoi as libCleanDoi,
} from '@/features/library/utils/author-doi.util';

export const ANNOTATION_COLORS = {
  yellow: { id: 'yellow', name: 'Yellow', bg: 'rgba(250, 204, 21, 0.35)', border: '#eab308' },
  emerald: { id: 'emerald', name: 'Green', bg: 'rgba(52, 211, 153, 0.35)', border: '#10b981' },
  sky: { id: 'sky', name: 'Blue', bg: 'rgba(56, 189, 248, 0.35)', border: '#0ea5e9' },
  purple: { id: 'purple', name: 'Purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#a855f7' },
  rose: { id: 'rose', name: 'Pink', bg: 'rgba(251, 113, 133, 0.35)', border: '#f43f5e' },
  amber: { id: 'amber', name: 'Orange', bg: 'rgba(251, 146, 60, 0.35)', border: '#f97316' },
} as const;

export type AnnotationColorId = keyof typeof ANNOTATION_COLORS;

export const PdfAnnotationEngine = {
  sortAnnotations(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return [...annotations].sort((a, b) => {
      const pageA = a.pageNumber ?? ((a.pageIndex ?? 0) + 1);
      const pageB = b.pageNumber ?? ((b.pageIndex ?? 0) + 1);
      if (pageA !== pageB) return pageA - pageB;

      const rectA = (a.rects?.[0] || a.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const rectB = (b.rects?.[0] || b.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const topA = rectA?.y1 ?? rectA?.y ?? 0;
      const topB = rectB?.y1 ?? rectB?.y ?? 0;
      if (Math.abs(topA - topB) > 0.005) return topA - topB;

      const leftA = rectA?.x1 ?? rectA?.x ?? 0;
      const leftB = rectB?.x1 ?? rectB?.x ?? 0;
      return leftA - leftB;
    });
  },

  filterAnnotations(
    annotations: ReaderAnnotation[],
    query?: string,
    colorFilter?: string | null,
  ): ReaderAnnotation[] {
    const q = query?.trim().toLowerCase() || '';
    const color = colorFilter?.trim().toLowerCase();

    return annotations.filter((a) => {
      if (q) {
        const textMatch =
          (a.quoteText || '').toLowerCase().includes(q) ||
          (a.text || '').toLowerCase().includes(q) ||
          (a.comment || '').toLowerCase().includes(q);
        if (!textMatch) return false;
      }

      if (color && color !== 'all') {
        const itemColor = (a.color || 'yellow').toLowerCase();
        if (color in ANNOTATION_COLORS) {
          const cfg = ANNOTATION_COLORS[color as AnnotationColorId];
          const matches =
            itemColor === color ||
            itemColor === cfg.border.toLowerCase() ||
            (color === 'yellow' && itemColor === '#ffeb3b');
          if (!matches) return false;
        } else if (itemColor !== color) {
          return false;
        }
      }

      return true;
    });
  },

  normalizeRect(rect: AnnotationRect | { x: number; y: number; width: number; height: number }): AnnotationRect {
    const r = rect as { x1?: number; y1?: number; x2?: number; y2?: number; x?: number; y?: number; width?: number; height?: number };
    const rawX = r.x1 ?? r.x ?? 0;
    const rawY = r.y1 ?? r.y ?? 0;
    const x = Math.max(0, Math.min(1, rawX));
    const y = Math.max(0, Math.min(1, rawY));
    const width = Math.max(0, Math.min(1 - x, r.width ?? (r.x2 ? r.x2 - rawX : 0)));
    const height = Math.max(0, Math.min(1 - y, r.height ?? (r.y2 ? r.y2 - rawY : 0)));

    return {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height,
      width,
      height,
    };
  },

  getColorConfig(colorId?: string): { bg: string; border: string } {
    if (colorId && colorId in ANNOTATION_COLORS) {
      const c = ANNOTATION_COLORS[colorId as AnnotationColorId];
      return { bg: c.bg, border: c.border };
    }
    return { bg: ANNOTATION_COLORS.yellow.bg, border: ANNOTATION_COLORS.yellow.border };
  },
};

export function cleanDoi(doi?: string | null): string | null {
  return libCleanDoi(doi) || null;
}

export function normalizeAuthors(authors?: string[], creators?: DocumentCreator[]): string[] {
  return libNormalizeAuthors(authors, creators as any);
}

export function generateCitationKey(paper: ReaderDocument): string {
  return libGenerateCitationKey(paper as any);
}



export function formatInTextCitation(paper: ReaderDocument, pageNumber?: number): string {
  const authors = normalizeAuthors(paper.authors, paper.creators);
  let authorStr = 'Unknown';
  if (authors.length === 1) {
    const parts = authors[0]!.trim().split(/\s+/);
    authorStr = parts[parts.length - 1] || authors[0]!;
  } else if (authors.length === 2) {
    const p1 = authors[0]!.trim().split(/\s+/);
    const p2 = authors[1]!.trim().split(/\s+/);
    authorStr = `${p1[p1.length - 1]} & ${p2[p2.length - 1]}`;
  } else if (authors.length > 2) {
    const p1 = authors[0]!.trim().split(/\s+/);
    authorStr = `${p1[p1.length - 1]} et al.`;
  }
  const yearStr = paper.year ? String(paper.year) : 'n.d.';
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
  return `(${authorStr}, ${yearStr}${pageStr})`;
}

