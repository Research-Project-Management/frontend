import { describe, it, expect, vi } from 'vitest';
import {
  extractPdfBookmarks,
  extractOutlineFromContent,
  parseDocumentOutline,
} from '@/features/editor/domain/document/pdf-outline';

describe('pdf-outline.util', () => {
  describe('extractPdfBookmarks', () => {
    it('should extract flat and nested bookmarks from a valid PDF.js document', async () => {
      const mockPdfDoc = {
        getOutline: vi.fn().mockResolvedValue([
          {
            title: '1. Introduction',
            dest: ['pageRef1', { name: 'XYZ' }],
            items: [
              {
                title: '1.1 Background & Motivation',
                dest: 'dest_bg',
                items: [],
              },
            ],
          },
          {
            title: '2. Methodology',
            dest: ['pageRef3', { name: 'Fit' }],
            items: [],
          },
        ]),
        getDestination: vi.fn().mockImplementation((name: string) => {
          if (name === 'dest_bg') return Promise.resolve(['pageRef2', { name: 'XYZ' }]);
          return Promise.resolve(null);
        }),
        getPageIndex: vi.fn().mockImplementation((ref: string) => {
          if (ref === 'pageRef1') return Promise.resolve(0); // page 1
          if (ref === 'pageRef2') return Promise.resolve(1); // page 2
          if (ref === 'pageRef3') return Promise.resolve(4); // page 5
          return Promise.resolve(0);
        }),
      };

      const outline = await extractPdfBookmarks(mockPdfDoc);

      expect(outline).toHaveLength(3);

      expect(outline[0]).toMatchObject({
        title: '1. Introduction',
        pageNumber: 1,
        level: 0,
      });

      expect(outline[1]).toMatchObject({
        title: '1.1 Background & Motivation',
        pageNumber: 2,
        level: 1,
      });

      expect(outline[2]).toMatchObject({
        title: '2. Methodology',
        pageNumber: 5,
        level: 0,
      });
    });

    it('should return an empty array if pdfDoc has no outline', async () => {
      const mockPdfDoc = {
        getOutline: vi.fn().mockResolvedValue(null),
      };

      const outline = await extractPdfBookmarks(mockPdfDoc);
      expect(outline).toEqual([]);
    });

    it('should handle null or invalid pdfDoc gracefully', async () => {
      expect(await extractPdfBookmarks(null)).toEqual([]);
      expect(await extractPdfBookmarks({})).toEqual([]);
    });
  });

  describe('extractOutlineFromContent (Fallback Parser)', () => {
    it('should extract LaTeX sections and map pages using SyncTeX map', () => {
      const latex = `
\\documentclass{article}
\\begin{document}

\\section{Introduction}
Some introduction text here.

\\subsection{Prior Work}
Previous research findings.

\\section{Methodology}
Our proposed technique.

\\subsubsection{Data Collection}
How data was gathered.

\\end{document}
      `;

      const synctexMap = {
        5: 1,  // Line 5: \section{Introduction} -> Page 1
        8: 1,  // Line 8: \subsection{Prior Work} -> Page 1
        11: 3, // Line 11: \section{Methodology} -> Page 3
        14: 4, // Line 14: \subsubsection{Data Collection} -> Page 4
      };

      const items = extractOutlineFromContent(latex, 5, synctexMap);

      expect(items).toHaveLength(4);

      expect(items[0]).toEqual({
        id: 'sec_0_5',
        title: 'Introduction',
        pageNumber: 1,
        level: 1,
      });

      expect(items[1]).toEqual({
        id: 'sec_1_8',
        title: 'Prior Work',
        pageNumber: 1,
        level: 2,
      });

      expect(items[2]).toEqual({
        id: 'sec_2_11',
        title: 'Methodology',
        pageNumber: 3,
        level: 1,
      });

      expect(items[3]).toEqual({
        id: 'sec_3_14',
        title: 'Data Collection',
        pageNumber: 4,
        level: 3,
      });
    });

    it('should approximate pages when no SyncTeX map is provided', () => {
      const lines: string[] = [];
      lines.push('\\section{First Chapter}');
      for (let i = 0; i < 50; i++) lines.push('Text line ' + i);
      lines.push('\\section{Second Chapter}');
      for (let i = 0; i < 50; i++) lines.push('Text line ' + i);

      const latex = lines.join('\n');
      const items = extractOutlineFromContent(latex, 10);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('First Chapter');
      expect(items[0].pageNumber).toBe(1);

      expect(items[1].title).toBe('Second Chapter');
      expect(items[1].pageNumber).toBeGreaterThan(1);
    });

    it('should return empty array for empty or non-LaTeX content', () => {
      expect(extractOutlineFromContent('')).toEqual([]);
      expect(extractOutlineFromContent('Just some plain text without sections')).toEqual([]);
    });
  });

  describe('parseDocumentOutline (File Outline Accordion)', () => {
    it('should parse Beamer presentation frames and frametitles', () => {
      const beamerTex = `
\\documentclass{beamer}
\\begin{document}
\\begin{frame}
  \\titlepage
\\end{frame}
\\begin{frame}{Motivation: Non-Convex Landscapes}
  Slide content
\\end{frame}
\\begin{frame}
  \\frametitle{The Adam Update Equations}
  Equations
\\end{frame}
\\end{document}
      `;

      const outline = parseDocumentOutline(beamerTex);
      expect(outline).toHaveLength(3);
      expect(outline[0]).toMatchObject({
        level: 2,
        levelName: 'Slide',
        title: 'Slide',
        line: 4,
      });
      expect(outline[1]).toMatchObject({
        level: 2,
        levelName: 'Slide',
        title: 'Motivation: Non-Convex Landscapes',
        line: 7,
      });
      expect(outline[2]).toMatchObject({
        level: 2,
        levelName: 'Slide',
        title: 'The Adam Update Equations',
        line: 10,
      });
    });

    it('should ignore commented-out headings and clean nested formatting macros', () => {
      const tex = `
% \\section{Hidden Old Section}
\\section{Analysis of \\textbf{Stochastic} \\textit{Gradients} in $\\mathcal{O}(d)$}
\\subsection{Derivation of \\underline{Bias Correction}}
      `;

      const outline = parseDocumentOutline(tex);
      expect(outline).toHaveLength(2);
      expect(outline[0].title).toBe('Analysis of Stochastic Gradients in O(d)');
      expect(outline[0].line).toBe(3);
      expect(outline[1].title).toBe('Derivation of Bias Correction');
      expect(outline[1].line).toBe(4);
    });

    it('should parse multi-line section titles', () => {
      const tex = `
\\section{This is a very long
section title that spans
across multiple lines}
      `;

      const outline = parseDocumentOutline(tex);
      expect(outline).toHaveLength(1);
      expect(outline[0].title).toBe(
        'This is a very long section title that spans across multiple lines',
      );
    });
  });
});
