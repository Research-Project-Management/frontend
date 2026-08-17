import type { ReaderAnnotation, AnnotationRect } from '../types/reader.types';

// ── 1. Annotation Colors ──────────────────────────────────────────────────────

export const ANNOTATION_COLORS = {
  yellow: { id: 'yellow', name: 'Yellow', bg: 'rgba(250, 204, 21, 0.35)', border: '#eab308' },
  emerald: { id: 'emerald', name: 'Green', bg: 'rgba(52, 211, 153, 0.35)', border: '#10b981' },
  sky: { id: 'sky', name: 'Blue', bg: 'rgba(56, 189, 248, 0.35)', border: '#0ea5e9' },
  purple: { id: 'purple', name: 'Purple', bg: 'rgba(192, 132, 252, 0.35)', border: '#a855f7' },
  rose: { id: 'rose', name: 'Pink', bg: 'rgba(251, 113, 133, 0.35)', border: '#f43f5e' },
  amber: { id: 'amber', name: 'Orange', bg: 'rgba(251, 146, 60, 0.35)', border: '#f97316' },
} as const;

export type AnnotationColorId = keyof typeof ANNOTATION_COLORS;

// ── 2. PdfAnnotationEngine ────────────────────────────────────────────────────

export const PdfAnnotationEngine = {
  sortAnnotations(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return [...annotations].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }

      const rectA = (a.rects?.[0] || a.boundingRect) as any;
      const rectB = (b.rects?.[0] || b.boundingRect) as any;
      const topA = rectA?.y1 ?? rectA?.y ?? 0;
      const topB = rectB?.y1 ?? rectB?.y ?? 0;
      if (Math.abs(topA - topB) > 0.005) {
        return topA - topB;
      }

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
        (a.comment || '').toLowerCase().includes(q)
    );
  },

  normalizeRect(rect: AnnotationRect | { x: number; y: number; width: number; height: number }): any {
    const rawX = (rect as any).x1 ?? (rect as any).x ?? 0;
    const rawY = (rect as any).y1 ?? (rect as any).y ?? 0;
    const x = Math.max(0, Math.min(1, rawX));
    const y = Math.max(0, Math.min(1, rawY));
    const width = Math.max(0, Math.min(1 - x, rect.width ?? ((rect as any).x2 ? (rect as any).x2 - rawX : 0)));
    const height = Math.max(0, Math.min(1 - y, rect.height ?? ((rect as any).y2 ? (rect as any).y2 - rawY : 0)));

    return {
      x,
      y,
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

// ── 3. Academic PDF Stream Generator ─────────────────────────────────────────

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxCharsPerLine = 75): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

export function generateAcademicPdfBlob(options: {
  title: string;
  authors?: string[];
  year?: number | string | null;
  journal?: string;
  doi?: string;
  abstract?: string;
}): Blob {
  const title = options.title || 'Research Paper';
  const authors = (options.authors && options.authors.length > 0)
    ? options.authors.join(', ')
    : 'Research Team';
  const venue = [options.journal, options.year ? `(${options.year})` : ''].filter(Boolean).join(' ') || 'Academic Preprint';
  const doi = options.doi ? `DOI: ${options.doi}` : '';
  const abstract = options.abstract || 'We present a rigorous computational and theoretical formulation addressing nonlinear operator learning and physics-informed models in scientific computing. The architecture demonstrates mesh-independent generalization and accelerated convergence for forward and inverse boundary value problems.';

  const contentStream: string[] = [];
  let y = 750;

  // Title
  contentStream.push('BT');
  contentStream.push('/F2 16 Tf');
  contentStream.push('0 0 0 rg');
  const titleLines = wrapText(title, 55);
  for (let i = 0; i < titleLines.length; i++) {
    contentStream.push(`50 ${y} Td`);
    contentStream.push(`(${escapePdfText(titleLines[i])}) Tj`);
    contentStream.push(`-50 -${y} Td`);
    y -= 22;
  }
  contentStream.push('ET');
  y -= 8;

  // Authors
  contentStream.push('BT');
  contentStream.push('/F1 10 Tf');
  contentStream.push('0.2 0.2 0.2 rg');
  const authorLines = wrapText(authors, 70);
  for (let i = 0; i < authorLines.length; i++) {
    contentStream.push(`50 ${y} Td`);
    contentStream.push(`(${escapePdfText(authorLines[i])}) Tj`);
    contentStream.push(`-50 -${y} Td`);
    y -= 14;
  }
  contentStream.push('ET');
  y -= 4;

  // Venue & DOI
  contentStream.push('BT');
  contentStream.push('/F1 9 Tf');
  contentStream.push('0.45 0.45 0.45 rg');
  contentStream.push(`50 ${y} Td`);
  contentStream.push(`(${escapePdfText([venue, doi].filter(Boolean).join(' • '))}) Tj`);
  contentStream.push(`-50 -${y} Td`);
  contentStream.push('ET');
  y -= 24;

  // Horizontal divider rule
  contentStream.push('0.85 0.85 0.85 RG');
  contentStream.push('0.75 w');
  contentStream.push(`50 ${y} m 545 ${y} l S`);
  y -= 20;

  // Abstract Heading
  contentStream.push('BT');
  contentStream.push('/F2 11 Tf');
  contentStream.push('0.1 0.1 0.1 rg');
  contentStream.push(`50 ${y} Td`);
  contentStream.push('(ABSTRACT) Tj');
  contentStream.push(`-50 -${y} Td`);
  contentStream.push('ET');
  y -= 16;

  // Abstract Body (Italic/Regular)
  contentStream.push('BT');
  contentStream.push('/F1 9.5 Tf');
  contentStream.push('0.2 0.2 0.2 rg');
  const abstractLines = wrapText(abstract, 80);
  for (let i = 0; i < abstractLines.length; i++) {
    contentStream.push(`50 ${y} Td`);
    contentStream.push(`(${escapePdfText(abstractLines[i])}) Tj`);
    contentStream.push(`-50 -${y} Td`);
    y -= 14;
  }
  contentStream.push('ET');
  y -= 20;

  // Section 1: Introduction
  contentStream.push('BT');
  contentStream.push('/F2 12 Tf');
  contentStream.push('0 0 0 rg');
  contentStream.push(`50 ${y} Td`);
  contentStream.push('(1. Introduction & Methodology) Tj');
  contentStream.push(`-50 -${y} Td`);
  contentStream.push('ET');
  y -= 16;

  const introText = 'Scientific workflows and literature management increasingly require low-latency indexing, full-text vector embeddings, and real-time retrieval-augmented generation. By consolidating semantic parsing with deep metadata resolution, researchers can extract relevant equations, methodologies, and cross-references instantaneously.';
  contentStream.push('BT');
  contentStream.push('/F1 9.5 Tf');
  contentStream.push('0.2 0.2 0.2 rg');
  const introLines = wrapText(introText, 80);
  for (let i = 0; i < introLines.length; i++) {
    contentStream.push(`50 ${y} Td`);
    contentStream.push(`(${escapePdfText(introLines[i])}) Tj`);
    contentStream.push(`-50 -${y} Td`);
    y -= 14;
  }
  contentStream.push('ET');
  y -= 20;

  // Section 2: Results & Discussion
  contentStream.push('BT');
  contentStream.push('/F2 12 Tf');
  contentStream.push('0 0 0 rg');
  contentStream.push(`50 ${y} Td`);
  contentStream.push('(2. Experimental Results & Synthesis) Tj');
  contentStream.push(`-50 -${y} Td`);
  contentStream.push('ET');
  y -= 16;

  const resultsText = 'Benchmarking across diverse scientific corpora highlights an empirical 4.2x speedup in document ingest latency and a 99.4% precision score in DOI citation mapping. The architecture provides full fallback resilience across hybrid storage and local browser caching layers.';
  contentStream.push('BT');
  contentStream.push('/F1 9.5 Tf');
  contentStream.push('0.2 0.2 0.2 rg');
  const resultsLines = wrapText(resultsText, 80);
  for (let i = 0; i < resultsLines.length; i++) {
    contentStream.push(`50 ${y} Td`);
    contentStream.push(`(${escapePdfText(resultsLines[i])}) Tj`);
    contentStream.push(`-50 -${y} Td`);
    y -= 14;
  }
  contentStream.push('ET');
  y -= 25;

  // Footer / Page number
  contentStream.push('BT');
  contentStream.push('/F1 8 Tf');
  contentStream.push('0.6 0.6 0.6 rg');
  contentStream.push('280 35 Td');
  contentStream.push('(- 1 -) Tj');
  contentStream.push('-280 -35 Td');
  contentStream.push('ET');

  const streamData = contentStream.join('\n');
  const streamLength = streamData.length;

  const pdfDocument = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595 842]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 5 0 R
      /F2 6 0 R
    >>
  >>
>>
endobj
4 0 obj
<<
  /Length ${streamLength}
>>
stream
${streamData}
endstream
endobj
5 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica
>>
endobj
6 0 obj
<<
  /Type /Font
  /Subtype /Type1
  /BaseFont /Helvetica-Bold
>>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000000 00000 n 
0000000000 00000 n 
trailer
<<
  /Size 7
  /Root 1 0 R
>>
startxref
${300 + streamLength}
%%EOF`;

  return new Blob([pdfDocument], { type: 'application/pdf' });
}
