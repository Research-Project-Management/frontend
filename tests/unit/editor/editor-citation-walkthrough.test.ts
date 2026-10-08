import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCitationKeys } from '@/features/editor/domain/utils/citation.util';
import {
  isLatexDocument,
  detectDocumentCitationStyle,
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from '@/features/editor/domain/utils/bibliography-generator.util';
import { libraryServices } from '@/features/library';

describe('Live Editor Citation & Bibliography Walkthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLibraryItems = [
    {
      id: 'item-vn-1',
      title: 'Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt',
      citationKey: 'nguyen2024ai',
      year: 2024,
      authors: [{ firstName: 'Văn A', lastName: 'Nguyễn' }],
      publicationTitle: 'Tạp chí Khoa học & Công nghệ',
    },
    {
      id: 'item-vn-2',
      title: 'Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long',
      citationKey: 'tran2023deep',
      year: 2023,
      authors: [{ firstName: 'Thị B', lastName: 'Trần' }, { firstName: 'Minh C', lastName: 'Lê' }],
      publicationTitle: 'Kỷ yếu Hội nghị Quốc tế VJIC',
    },
  ];

  describe('Scenario 1: Markdown Research Proposal (Đề cương nghiên cứu)', () => {
    it('walks through typing citations, detecting keys, and injecting formatted references', async () => {
      // 1. Initial Markdown proposal content written by student/researcher
      const initialDoc = `# Đề cương Nghiên cứu Khoa học

## 1. Giới thiệu tổng quan
Trong những năm gần đây, xử lý ngôn ngữ tự nhiên đã có nhiều đột phá quan trọng [@nguyen2024ai].
Đặc biệt, việc ứng dụng học sâu trong các bài toán dự báo khí tượng [@tran2023deep] đem lại độ chính xác cao.

## 2. Phương pháp tiếp cận
Chúng tôi áp dụng kiến trúc Transformer kết hợp cơ chế chú ý.`;

      // 2. Extract citation keys
      const keys = extractCitationKeys(initialDoc);
      expect(keys).toEqual(['nguyen2024ai', 'tran2023deep']);

      // 3. Document format detection
      const isLatex = isLatexDocument(initialDoc, 'de-cuong.md');
      expect(isLatex).toBe(false);

      // 4. Mock CSL batch formatting response from backend
      const mockBatchResponse = {
        bibliographyText:
          'Nguyễn, V. A. (2024). Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt. Tạp chí Khoa học & Công nghệ.\n' +
          'Trần, T. B., & Lê, M. C. (2023). Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long. Kỷ yếu Hội nghị Quốc tế VJIC.',
        citations: [
          {
            paperId: 'item-vn-1',
            citation: {
              inText: '(Nguyễn, 2024)',
              bibliography:
                'Nguyễn, V. A. (2024). Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt. Tạp chí Khoa học & Công nghệ.',
            },
          },
          {
            paperId: 'item-vn-2',
            citation: {
              inText: '(Trần & Lê, 2023)',
              bibliography:
                'Trần, T. B., & Lê, M. C. (2023). Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long. Kỷ yếu Hội nghị Quốc tế VJIC.',
            },
          },
        ],
      };

      vi.spyOn(libraryServices.citations, 'batchFormat').mockResolvedValueOnce(mockBatchResponse as any);

      const batchResult = await libraryServices.citations.batchFormat(
        'project-1',
        mockLibraryItems.map((i) => i.id),
        'apa',
      );
      expect(batchResult.bibliographyText).toContain('Nguyễn, V. A. (2024)');
      expect(batchResult.bibliographyText).toContain('Trần, T. B., & Lê, M. C. (2023)');

      // 5. Generate formatted bibliography section for Markdown (APA style)
      const bibSection = buildBibliographySection({
        bibliographyText: batchResult.bibliographyText,
        format: 'markdown',
        styleId: 'apa',
        citations: batchResult.citations.map((c, idx) => ({
          key: mockLibraryItems[idx].citationKey,
          inText: c.citation.inText,
          bibliography: c.citation.bibliography,
        })),
      });

      expect(bibSection).toContain('## Tài liệu tham khảo');
      expect(bibSection).toContain('1. Nguyễn, V. A. (2024)');
      expect(bibSection).toContain('2. Trần, T. B., & Lê, M. C. (2023)');

      // 6. Inject into Markdown document
      const { nextContent: injectedDoc, action: action1 } = injectBibliographyIntoDocument({
        currentContent: initialDoc,
        newSection: bibSection,
        format: 'markdown',
      });

      expect(action1).toBe('appended');
      expect(injectedDoc).toContain('## 2. Phương pháp tiếp cận');
      expect(injectedDoc).toContain('## Tài liệu tham khảo\n\n1. Nguyễn, V. A. (2024)');

      // 7. Verify Idempotency: User adds another citation and clicks "Chèn vào đề cương" again
      const updatedUserText = injectedDoc.replace(
        'Chúng tôi áp dụng kiến trúc Transformer kết hợp cơ chế chú ý.',
        'Chúng tôi áp dụng kiến trúc Transformer kết hợp cơ chế chú ý [@nguyen2024ai]. Thêm trích dẫn mới.',
      );

      const { nextContent: reInjectedDoc, action: action2 } = injectBibliographyIntoDocument({
        currentContent: updatedUserText,
        newSection: bibSection,
        format: 'markdown',
      });

      expect(action2).toBe('replaced');
      // Must have exactly one "## Tài liệu tham khảo" heading
      const occurrences = (reInjectedDoc.match(/## Tài liệu tham khảo/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('Scenario 2: LaTeX Manuscript with IEEE Numeric Style', () => {
    it('walks through LaTeX \\cite detection, thebibliography generation, and injection before \\end{document}', async () => {
      // 1. Initial LaTeX document
      const initialLatex = `\\documentclass[12pt]{article}
\\usepackage{amsmath}
\\begin{document}
\\title{Nghiên cứu mô hình ngôn ngữ}
\\maketitle

\\section{Giới thiệu}
Mô hình Attention là nền tảng \\cite{nguyen2024ai}. Các ứng dụng sâu cũng được chứng minh \\cite{tran2023deep}.

\\section{Phương pháp}
Mô tả chi tiết thuật toán.

\\end{document}`;

      // 2. Verify LaTeX detection
      const isLatex = isLatexDocument(initialLatex, 'main.tex');
      expect(isLatex).toBe(true);

      // 3. Extract citation keys
      const keys = extractCitationKeys(initialLatex);
      expect(keys).toEqual(['nguyen2024ai', 'tran2023deep']);

      // 4. Format with IEEE numeric style
      const mockIeeeCitations = [
        {
          key: 'nguyen2024ai',
          inText: '[1]',
          bibliography: 'V. A. Nguyen, "Nghiên cứu ứng dụng Trí tuệ nhân tạo," Tap chi Khoa hoc, 2024.',
        },
        {
          key: 'tran2023deep',
          inText: '[2]',
          bibliography: 'T. B. Tran and M. C. Le, "Mô hình học sâu dự báo thời tiết," VJIC, 2023.',
        },
      ];

      const latexBibSection = buildBibliographySection({
        bibliographyText: '',
        format: 'latex',
        styleId: 'ieee',
        citations: mockIeeeCitations,
      });

      expect(latexBibSection).toContain('\\begin{thebibliography}{99}');
      expect(latexBibSection).toContain('\\bibitem{nguyen2024ai}');
      expect(latexBibSection).toContain('\\bibitem{tran2023deep}');
      expect(latexBibSection).toContain('\\end{thebibliography}');

      // 5. Inject into LaTeX document (must be placed before \\end{document})
      const { nextContent: injectedLatex, action: actionLatex } = injectBibliographyIntoDocument({
        currentContent: initialLatex,
        newSection: latexBibSection,
        format: 'latex',
      });

      expect(actionLatex).toBe('appended');
      expect(injectedLatex.endsWith('\\end{document}')).toBe(true);
      expect(injectedLatex).toContain('\\begin{thebibliography}{99}');

      // 6. Test idempotent replacement in LaTeX
      const { nextContent: reInjectedLatex, action: reActionLatex } = injectBibliographyIntoDocument({
        currentContent: injectedLatex,
        newSection: latexBibSection,
        format: 'latex',
      });

      expect(reActionLatex).toBe('replaced');
      const bibOccurrences = (reInjectedLatex.match(/\\begin\{thebibliography\}/g) || []).length;
      expect(bibOccurrences).toBe(1);
    });
  });

  describe('Scenario 3: Missing Citation Keys Handling', () => {
    it('detects cited keys in document that do not exist in library', () => {
      const docWithMissing = `# Bài viết
Chúng tôi tham khảo bài báo [@knownKey] và bài báo chưa nhập [@unknownKey2026].`;

      const allKeys = extractCitationKeys(docWithMissing);
      expect(allKeys).toEqual(['knownKey', 'unknownKey2026']);

      const libraryKeySet = new Set(['knownkey']);
      const resolved = allKeys.filter((k) => libraryKeySet.has(k.toLowerCase()));
      const missing = allKeys.filter((k) => !libraryKeySet.has(k.toLowerCase()));

      expect(resolved).toEqual(['knownKey']);
      expect(missing).toEqual(['unknownKey2026']);
    });
  });

  describe('Scenario 4: Vietnamese Ministry of Education Standards (TCVN / Bộ GD&ĐT)', () => {
    it('formats thesis proposal references using natural Vietnamese author order and MoET sorting', async () => {
      const thesisDoc = `# Đề cương Luận án Tiến sĩ

## 1. Tính cấp thiết của đề tài
Nghiên cứu về mô hình thị giác [@tran2023deep] và trí tuệ nhân tạo [@nguyen2024ai] đang phát triển rất mạnh mẽ.`;

      const keys = extractCitationKeys(thesisDoc);
      expect(keys).toEqual(['tran2023deep', 'nguyen2024ai']);

      // Mock backend TCVN batch format response
      const mockTcvnResponse = {
        styleId: 'tcvn',
        combinedInText: '(Nguyễn Văn An, 2024; Trần Thị Bình và Lê Văn Cường, 2023)',
        bibliographyText:
          '1. Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.\n\n' +
          '2. Trần Thị Bình và Lê Văn Cường (2023), "Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long", Kỷ yếu Hội nghị Quốc tế VJIC.',
        citations: [
          {
            paperId: 'item-vn-1',
            citation: {
              inText: '(Nguyễn Văn An, 2024)',
              bibliography:
                '1. Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.',
            },
          },
          {
            paperId: 'item-vn-2',
            citation: {
              inText: '(Trần Thị Bình và Lê Văn Cường, 2023)',
              bibliography:
                '2. Trần Thị Bình và Lê Văn Cường (2023), "Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long", Kỷ yếu Hội nghị Quốc tế VJIC.',
            },
          },
        ],
      };

      vi.spyOn(libraryServices.citations, 'batchFormat').mockResolvedValueOnce(mockTcvnResponse as any);

      const batchResult = await libraryServices.citations.batchFormat(
        'project-thesis',
        ['item-vn-1', 'item-vn-2'],
        'tcvn' as any,
      );

      // Verify TCVN Natural Name: "Nguyễn Văn An" instead of "An, N. V."
      expect(batchResult.bibliographyText).toContain('Nguyễn Văn An (2024)');
      expect(batchResult.bibliographyText).toContain('Trần Thị Bình và Lê Văn Cường (2023)');

      const bibSection = buildBibliographySection({
        bibliographyText: batchResult.bibliographyText,
        format: 'markdown',
        styleId: 'tcvn',
        citations: batchResult.citations.map((c, idx) => ({
          key: idx === 0 ? 'nguyen2024ai' : 'tran2023deep',
          inText: c.citation.inText,
          bibliography: c.citation.bibliography,
        })),
      });

      expect(bibSection).toContain('## Tài liệu tham khảo');
      expect(bibSection).toContain('1. Nguyễn Văn An (2024)');
      expect(bibSection).toContain('2. Trần Thị Bình và Lê Văn Cường (2023)');

      const { nextContent } = injectBibliographyIntoDocument({
        currentContent: thesisDoc,
        newSection: bibSection,
        format: 'markdown',
      });

      expect(nextContent).toContain('## 1. Tính cấp thiết của đề tài');
      expect(nextContent).toContain('## Tài liệu tham khảo\n\n1. Nguyễn Văn An (2024)');
    });
  });

  describe('Scenario 4: Fully Automated 1-Click Detection & Injection (Zero Configuration)', () => {
    it('automatically detects markdown proposal context and injects Vietnamese references without style selection', async () => {
      const documentContent = `# Nghiên cứu Khoa học
Công nghệ ngôn ngữ tự nhiên đã có nhiều bước tiến mới [@nguyen2024ai].
Đồng thời phương pháp học sâu [@tran2023deep] mang lại kết quả khả quan.`;

      // 1. Auto-detect document style
      const detectedStyle = detectDocumentCitationStyle(documentContent, 'decuong.md');
      expect(detectedStyle).toBe('auto');

      // 2. Mock batch format response with 'auto' style
      const mockAutoResponse = {
        style: 'auto',
        total: 2,
        combinedInText: '(Nguyễn Văn An, 2024; Trần Thị Bình và Lê Văn Cường, 2023)',
        bibliographyText:
          'Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.\n' +
          'Trần Thị Bình và Lê Văn Cường (2023), "Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long", Kỷ yếu Hội nghị Quốc tế VJIC.',
        citations: [
          {
            paperId: 'item-vn-1',
            citation: {
              inText: '(Nguyễn Văn An, 2024)',
              bibliography:
                'Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.',
            },
          },
          {
            paperId: 'item-vn-2',
            citation: {
              inText: '(Trần Thị Bình và Lê Văn Cường, 2023)',
              bibliography:
                'Trần Thị Bình và Lê Văn Cường (2023), "Mô hình học sâu dự báo thời tiết tại khu vực đồng bằng sông Cửu Long", Kỷ yếu Hội nghị Quốc tế VJIC.',
            },
          },
        ],
      };

      vi.spyOn(libraryServices.citations, 'batchFormat').mockResolvedValueOnce(mockAutoResponse as any);

      // 3. User clicks 1-click button "Chèn vào đề cương" (zero dropdown interaction!)
      const batchResult = await libraryServices.citations.batchFormat(
        'project-1',
        ['item-vn-1', 'item-vn-2'],
        detectedStyle,
      );

      const bibSection = buildBibliographySection({
        bibliographyText: batchResult.bibliographyText || '',
        format: 'markdown',
        styleId: detectedStyle,
        citations: batchResult.citations.map((c, idx) => ({
          key: idx === 0 ? 'nguyen2024ai' : 'tran2023deep',
          inText: c.citation.inText,
          bibliography: c.citation.bibliography,
        })),
      });

      const { nextContent } = injectBibliographyIntoDocument({
        currentContent: documentContent,
        newSection: bibSection,
        format: 'markdown',
      });

      expect(nextContent).toContain('## Tài liệu tham khảo');
      expect(nextContent).toContain('1. Nguyễn Văn An (2024)');
      expect(nextContent).toContain('2. Trần Thị Bình và Lê Văn Cường (2023)');
    });

    it('automatically detects LaTeX paper context and formats numeric thebibliography', async () => {
      const latexContent = `\\documentclass{article}
\\begin{document}
Machine learning advances \\cite{nguyen2024ai} have enabled new capabilities.
\\end{document}`;

      const detectedStyle = detectDocumentCitationStyle(latexContent, 'paper.tex');
      expect(detectedStyle).toBe('auto-numeric');

      const mockNumericResponse = {
        style: 'auto-numeric',
        total: 1,
        combinedInText: '[1]',
        bibliographyText:
          '[1] Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.',
        citations: [
          {
            paperId: 'item-vn-1',
            citation: {
              inText: '[1]',
              bibliography:
                '[1] Nguyễn Văn An (2024), "Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý ngôn ngữ tự nhiên tiếng Việt", Tạp chí Khoa học & Công nghệ.',
            },
          },
        ],
      };

      vi.spyOn(libraryServices.citations, 'batchFormat').mockResolvedValueOnce(mockNumericResponse as any);

      const batchResult = await libraryServices.citations.batchFormat(
        'project-1',
        ['item-vn-1'],
        detectedStyle,
      );

      const bibSection = buildBibliographySection({
        bibliographyText: batchResult.bibliographyText || '',
        format: 'latex',
        styleId: detectedStyle,
        citations: batchResult.citations.map((c) => ({
          key: 'nguyen2024ai',
          inText: c.citation.inText,
          bibliography: c.citation.bibliography,
        })),
      });

      const { nextContent } = injectBibliographyIntoDocument({
        currentContent: latexContent,
        newSection: bibSection,
        format: 'latex',
      });

      expect(nextContent).toContain('\\begin{thebibliography}{99}');
      expect(nextContent).toContain('\\bibitem{nguyen2024ai}');
      expect(nextContent).toContain('Nguyễn Văn An (2024)');
      expect(nextContent.endsWith('\\end{document}')).toBe(true);
    });
  });
});
