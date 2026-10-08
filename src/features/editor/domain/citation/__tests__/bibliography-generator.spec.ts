import { describe, it, expect } from 'vitest';
import {
  isLatexDocument,
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from '../bibliography-generator';

describe('bibliography-generator.util', () => {
  describe('isLatexDocument', () => {
    it('detects LaTeX documents by file extension', () => {
      expect(isLatexDocument('', 'manuscript.tex')).toBe(true);
      expect(isLatexDocument('', 'chapter.latex')).toBe(true);
      expect(isLatexDocument('', 'decuong.md')).toBe(false);
    });

    it('detects LaTeX documents by content markers', () => {
      const latexDoc = '\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}';
      expect(isLatexDocument(latexDoc)).toBe(true);

      const markdownDoc = '# Đề cương nghiên cứu\n\nNội dung đề cương theo chuẩn.';
      expect(isLatexDocument(markdownDoc)).toBe(false);
    });
  });

  describe('buildBibliographySection', () => {
    it('builds a clean Markdown bibliography section in APA style', () => {
      const bibText =
        'Nguyễn, V. A. (2023). Nghiên cứu trí tuệ nhân tạo.\n\nTrần, T. B. (2024). Xử lý ảnh y tế.';
      const result = buildBibliographySection({
        bibliographyText: bibText,
        format: 'markdown',
        styleId: 'apa',
      });

      expect(result).toContain('## Tài liệu tham khảo');
      expect(result).toContain('1. Nguyễn, V. A. (2023). Nghiên cứu trí tuệ nhân tạo.');
      expect(result).toContain('2. Trần, T. B. (2024). Xử lý ảnh y tế.');
    });

    it('builds a clean Markdown bibliography section in numeric IEEE style', () => {
      const bibText =
        '[1] V. A. Nguyễn, "Nghiên cứu trí tuệ nhân tạo," 2023.\n\n[2] T. B. Trần, "Xử lý ảnh y tế," 2024.';
      const result = buildBibliographySection({
        bibliographyText: bibText,
        format: 'markdown',
        styleId: 'ieee',
      });

      expect(result).toContain('## Tài liệu tham khảo');
      expect(result).toContain('[1] V. A. Nguyễn, "Nghiên cứu trí tuệ nhân tạo," 2023.');
    });

    it('builds a clean LaTeX thebibliography environment', () => {
      const citations = [
        {
          key: 'nguyen2023',
          bibliography: 'V. A. Nguyễn, "Nghiên cứu trí tuệ nhân tạo," 2023.',
        },
        {
          key: 'tran2024',
          bibliography: 'T. B. Trần, "Xử lý ảnh y tế," 2024.',
        },
      ];

      const result = buildBibliographySection({
        bibliographyText: '',
        format: 'latex',
        styleId: 'ieee',
        citations,
      });

      expect(result).toContain('\\begin{thebibliography}{99}');
      expect(result).toContain('\\bibitem{nguyen2023}');
      expect(result).toContain('\\bibitem{tran2024}');
      expect(result).toContain('\\end{thebibliography}');
    });
  });

  describe('injectBibliographyIntoDocument', () => {
    it('appends bibliography to a markdown document without existing section', () => {
      const original = '# Đề cương\n\nNội dung bài viết.';
      const section = '## Tài liệu tham khảo\n\n1. Nguyễn, V. A. (2023).';

      const result = injectBibliographyIntoDocument({
        currentContent: original,
        newSection: section,
        format: 'markdown',
      });

      expect(result.action).toBe('appended');
      expect(result.nextContent).toContain('# Đề cương');
      expect(result.nextContent).toContain('## Tài liệu tham khảo');
      expect(result.nextContent).toContain('1. Nguyễn, V. A. (2023).');
    });

    it('replaces existing bibliography section in markdown without duplicating', () => {
      const original =
        '# Đề cương\n\nNội dung bài viết.\n\n## Tài liệu tham khảo\n\n1. Cũ, A. (2020).';
      const newSection = '## Tài liệu tham khảo\n\n1. Nguyễn, V. A. (2023).\n2. Trần, T. B. (2024).';

      const result = injectBibliographyIntoDocument({
        currentContent: original,
        newSection: newSection,
        format: 'markdown',
      });

      expect(result.action).toBe('replaced');
      expect(result.nextContent).not.toContain('Cũ, A. (2020).');
      expect(result.nextContent).toContain('1. Nguyễn, V. A. (2023).');
      expect(result.nextContent).toContain('2. Trần, T. B. (2024).');
    });

    it('injects before \\end{document} in LaTeX document', () => {
      const original = '\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}';
      const bibSection = '\\begin{thebibliography}{99}\n\\bibitem{a} Ref\n\\end{thebibliography}';

      const result = injectBibliographyIntoDocument({
        currentContent: original,
        newSection: bibSection,
        format: 'latex',
      });

      expect(result.action).toBe('appended');
      expect(result.nextContent).toContain('\\bibitem{a} Ref');
      expect(result.nextContent.endsWith('\\end{document}')).toBe(true);
    });

    it('replaces existing \\begin{thebibliography} in LaTeX document', () => {
      const original =
        '\\documentclass{article}\n\\begin{document}\nHello.\n\\begin{thebibliography}{99}\n\\bibitem{old} Old\n\\end{thebibliography}\n\\end{document}';
      const newBibSection =
        '\\begin{thebibliography}{99}\n\\bibitem{new} New\n\\end{thebibliography}';

      const result = injectBibliographyIntoDocument({
        currentContent: original,
        newSection: newBibSection,
        format: 'latex',
      });

      expect(result.action).toBe('replaced');
      expect(result.nextContent).not.toContain('\\bibitem{old}');
      expect(result.nextContent).toContain('\\bibitem{new} New');
    });
  });
});
