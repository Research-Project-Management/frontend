import type { ReaderAnnotation, AnnotationRect, ReaderDocument, DocumentCreator } from '../types/reader.types';

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

  filterAnnotations(annotations: ReaderAnnotation[], query: string): ReaderAnnotation[] {
    if (!query || !query.trim()) return annotations;
    const q = query.trim().toLowerCase();

    return annotations.filter(
      (a) =>
        (a.text || '').toLowerCase().includes(q) ||
        (a.comment || '').toLowerCase().includes(q),
    );
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
  if (!doi || !doi.trim()) return null;
  const cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
  return cleaned || null;
}

export function normalizeAuthors(authors?: string[], creators?: DocumentCreator[]): string[] {
  if (Array.isArray(authors) && authors.length > 0) {
    return authors.filter(Boolean);
  }
  if (Array.isArray(creators) && creators.length > 0) {
    return creators
      .map((c) => c.fullName || c.name || [c.firstName, c.lastName].filter(Boolean).join(' '))
      .filter(Boolean);
  }
  return [];
}

export function generateCitationKey(paper: ReaderDocument): string {
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeAuthors(paper.authors, paper.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const firstAuthor = authors[0]!.trim();
    const parts = firstAuthor.split(/\s+/);
    authorPart = (parts[parts.length - 1] || firstAuthor).toLowerCase();
  }
  authorPart = authorPart.replace(/[^a-z0-9]/gi, '');

  const yearPart = paper.year ? String(paper.year) : '';
  const STOPWORDS = new Set(['a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via', 'to', 'is', 'are']);
  let titlePart = '';
  if (paper.title) {
    for (const word of paper.title.trim().split(/\s+/)) {
      const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean && !STOPWORDS.has(clean)) {
        titlePart = clean;
        break;
      }
    }
  }

  return `${authorPart || 'ref'}${yearPart}${titlePart || 'doc'}`;
}

export function getBibTeXEntryType(paper: ReaderDocument): string {
  const itemType = (paper.itemType || '').toLowerCase();
  switch (itemType) {
    case 'book':
    case 'booksection':
      return 'book';
    case 'conferencepaper':
    case 'proceedings':
    case 'inproceedings':
      return 'inproceedings';
    case 'thesis':
    case 'phdthesis':
    case 'mastersthesis':
      return 'phdthesis';
    case 'techreport':
    case 'report':
      return 'techreport';
    case 'webpage':
    case 'website':
    case 'dataset':
    case 'software':
    case 'misc':
      return 'misc';
    case 'journalarticle':
    case 'article':
    case 'preprint':
    default:
      if (itemType && !['journalarticle', 'article', 'preprint'].includes(itemType) && !paper.journal && !paper.publicationTitle) {
        return 'misc';
      }
      return 'article';
  }
}

export function convertToBibTeX(paper: ReaderDocument): string {
  const entryType = getBibTeXEntryType(paper);
  const citationKey = generateCitationKey(paper);
  const fields: string[] = [];

  if (paper.title) {
    fields.push(`  title = {${paper.title}}`);
  }

  const authors = normalizeAuthors(paper.authors, paper.creators);
  if (authors.length > 0) {
    fields.push(`  author = {${authors.join(' and ')}}`);
  }

  const journal = paper.journal || paper.publicationTitle;
  if (journal) {
    if (entryType === 'inproceedings') {
      fields.push(`  booktitle = {${journal}}`);
    } else {
      fields.push(`  journal = {${journal}}`);
    }
  }

  if (paper.year) fields.push(`  year = {${paper.year}}`);
  if (paper.volume) fields.push(`  volume = {${paper.volume}}`);
  if (paper.issue) fields.push(`  number = {${paper.issue}}`);
  if (paper.pages) fields.push(`  pages = {${paper.pages}}`);
  if (paper.publisher) fields.push(`  publisher = {${paper.publisher}}`);

  const doi = cleanDoi(paper.doi);
  if (doi) fields.push(`  doi = {${doi}}`);
  if (paper.url) fields.push(`  url = {${paper.url}}`);

  return `@${entryType}{${citationKey},\n${fields.join(',\n')}\n}`;
}

export function downloadBibTeXFile(paper: ReaderDocument, filename?: string): void {
  const content = convertToBibTeX(paper);
  const name = filename || `${generateCitationKey(paper)}.bib`;
  const blob = new Blob([content], { type: 'application/x-bibtex;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
