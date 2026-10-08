import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  LatexSymbolsIndex,
  latexSymbolsIndex,
} from '@/features/editor/domain/latex-symbols-index';
import {
  isVietnameseAuthorName,
  formatShortAuthor,
  formatInTextCitationPreview,
  formatBibliographyPreview,
} from '@/features/editor/domain/utils/citation.util';
import { latexCitationHoverTooltip } from '@/features/editor/engines/extensions/latex-citation-hover';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

describe('Editor Citation Autocomplete & Hover Tooltip Suite', () => {
  beforeEach(() => {
    latexSymbolsIndex.clear();
    vi.clearAllMocks();
  });

  describe('1. Cultural Vietnamese & International Author Formatting', () => {
    it('detects Vietnamese author names from diacritics and common surnames', () => {
      expect(isVietnameseAuthorName('Nguyễn Văn An')).toBe(true);
      expect(isVietnameseAuthorName('Tran Thi Binh')).toBe(true); // without diacritics, matches Tran surname
      expect(isVietnameseAuthorName('Lê Văn Cường')).toBe(true);
      expect(isVietnameseAuthorName('Pham Van Dong')).toBe(true);
      expect(isVietnameseAuthorName('Alan Turing')).toBe(false);
      expect(isVietnameseAuthorName('Ashish Vaswani')).toBe(false);
      expect(isVietnameseAuthorName('Donald E. Knuth')).toBe(false);
    });

    it('formats single author cleanly', () => {
      // Natural Vietnamese maintains full name
      expect(formatShortAuthor('Nguyễn Văn An')).toBe('Nguyễn Văn An');
      // Accidental comma in bib author is healed
      expect(formatShortAuthor('Nguyễn, Văn An')).toBe('Nguyễn Văn An');
      // Western author extracts last name
      expect(formatShortAuthor('Alan Turing')).toBe('Turing');
      expect(formatShortAuthor('Turing, Alan M.')).toBe('Turing');
    });

    it('formats two authors with ampersand', () => {
      expect(formatShortAuthor('Nguyễn Văn An and Trần Thị Bình')).toBe('Nguyễn Văn An & Trần Thị Bình');
      expect(formatShortAuthor('Knuth, Donald and Lamport, Leslie')).toBe('Knuth & Lamport');
    });

    it('formats three or more authors with culturally accurate "và c.s." or "et al."', () => {
      // Vietnamese: "và cộng sự"
      expect(formatShortAuthor('Nguyễn Văn An and Trần Thị Bình and Lê Văn Cường')).toBe('Nguyễn Văn An và c.s.');
      // Western: "et al."
      expect(formatShortAuthor('Ashish Vaswani and Noam Shazeer and Niki Parmar and Jakob Uszkoreit')).toBe(
        'Vaswani et al.'
      );
    });

    it('formats in-text and bibliography previews', () => {
      const vnEntry = {
        key: 'nguyen2024ai',
        author: 'Nguyễn Văn An and Trần Thị Bình and Lê Văn Cường',
        title: 'Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý tiếng Việt',
        journal: 'Tạp chí Khoa học & Công nghệ',
        year: '2024',
        doi: '10.1234/vnai.2024',
      };

      const inText = formatInTextCitationPreview(vnEntry);
      expect(inText).toBe('(Nguyễn Văn An và c.s., 2024)');

      const bib = formatBibliographyPreview(vnEntry);
      expect(bib).toContain('Nguyễn Văn An và c.s. (2024)');
      expect(bib).toContain('"Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý tiếng Việt"');
      expect(bib).toContain('Tạp chí Khoa học & Công nghệ');
      expect(bib).toContain('DOI: 10.1234/vnai.2024');
    });
  });

  describe('2. Diacritic-Insensitive Fuzzy Citation Search in Symbols Index', () => {
    beforeEach(() => {
      latexSymbolsIndex.setLibraryCitations([
        {
          id: 'item-1',
          citationKey: 'nguyen2024ai',
          title: 'Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý tiếng Việt',
          year: 2024,
          authors: [{ fullName: 'Nguyễn Văn An' }, { fullName: 'Trần Thị Bình' }],
          journal: 'Tạp chí Khoa học & Công nghệ',
          doi: '10.1234/jst.2024',
        },
        {
          id: 'item-2',
          citationKey: 'vaswani2017attention',
          title: 'Attention Is All You Need',
          year: 2017,
          authors: [{ fullName: 'Ashish Vaswani' }, { fullName: 'Noam Shazeer' }],
          journal: 'NeurIPS',
          doi: '10.5555/3295222.3295349',
        },
      ]);
    });

    it('matches by unaccented Vietnamese search string', () => {
      // Searching "van an" matches "Nguyễn Văn An"
      const res = latexSymbolsIndex.getCitations('van an');
      expect(res.length).toBe(1);
      expect(res[0].key).toBe('nguyen2024ai');

      // Searching "tri tue nhan tao" matches title
      const titleRes = latexSymbolsIndex.getCitations('tri tue nhan tao');
      expect(titleRes.length).toBe(1);
      expect(titleRes[0].key).toBe('nguyen2024ai');

      // Searching "khoa hoc" matches journal
      const journalRes = latexSymbolsIndex.getCitations('khoa hoc');
      expect(journalRes.length).toBe(1);
      expect(journalRes[0].key).toBe('nguyen2024ai');
    });

    it('matches by accented Vietnamese search string', () => {
      const res = latexSymbolsIndex.getCitations('Nguyễn');
      expect(res.length).toBe(1);
      expect(res[0].key).toBe('nguyen2024ai');
    });

    it('matches by key or publication year', () => {
      const keyRes = latexSymbolsIndex.getCitations('vaswani');
      expect(keyRes.length).toBe(1);
      expect(keyRes[0].key).toBe('vaswani2017attention');

      const yearRes = latexSymbolsIndex.getCitations('2017');
      expect(yearRes.length).toBe(1);
      expect(yearRes[0].key).toBe('vaswani2017attention');
    });

    it('retrieves single citation by exact key via getCitationByKey', () => {
      const found = latexSymbolsIndex.getCitationByKey('nguyen2024ai');
      expect(found).toBeDefined();
      expect(found?.title).toBe('Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý tiếng Việt');
      expect(found?.year).toBe('2024');

      const notFound = latexSymbolsIndex.getCitationByKey('nonexistentKey');
      expect(notFound).toBeUndefined();
    });
  });

  describe('3. CodeMirror 6 Hover Tooltip Extension', () => {
    beforeEach(() => {
      latexSymbolsIndex.setLibraryCitations([
        {
          id: 'item-vn',
          citationKey: 'nguyen2024ai',
          title: 'Nghiên cứu ứng dụng Trí tuệ nhân tạo trong xử lý tiếng Việt',
          year: 2024,
          authors: [{ fullName: 'Nguyễn Văn An' }, { fullName: 'Trần Thị Bình' }],
          journal: 'Tạp chí Khoa học',
          doi: '10.1234/vn.2024',
        },
        {
          id: 'item-us',
          citationKey: 'vaswani2017attention',
          title: 'Attention Is All You Need',
          year: 2017,
          authors: [{ fullName: 'Ashish Vaswani' }, { fullName: 'Noam Shazeer' }],
          journal: 'NeurIPS',
          doi: '10.5555/vaswani',
        },
      ]);
    });

    it('triggers tooltip when hovering over \\cite{key}', () => {
      const doc = 'Theo nghiên cứu của \\cite{nguyen2024ai}, mô hình đạt độ chính xác cao.';
      const state = EditorState.create({
        doc,
        extensions: [latexCitationHoverTooltip],
      });
      const view = new EditorView({ state });

      // Position in the middle of 'nguyen2024ai' (char index 30)
      const hoverPos = doc.indexOf('nguyen2024ai') + 4;
      const tooltip = (latexCitationHoverTooltip as any).source(view, hoverPos, 1);

      expect(tooltip).not.toBeNull();
      expect(tooltip.pos).toBe(doc.indexOf('nguyen2024ai'));
      expect(tooltip.end).toBe(doc.indexOf('nguyen2024ai') + 'nguyen2024ai'.length);

      // Render DOM
      const { dom } = tooltip.create();
      expect(dom.textContent).toContain('@nguyen2024ai');
      expect(dom.textContent).toContain('Nghiên cứu ứng dụng Trí tuệ nhân tạo');
      expect(dom.textContent).toContain('Nguyễn Văn An & Trần Thị Bình');
      expect(dom.textContent).toContain('2024');
      expect(dom.textContent).toContain('Tạp chí Khoa học');

      view.destroy();
    });

    it('identifies the exact hovered key in multi-citation \\citep[p. 10]{key1, key2}', () => {
      const doc = 'Các kết quả trước đây \\citep[xem][tr. 10]{vaswani2017attention, nguyen2024ai} cho thấy...';
      const state = EditorState.create({
        doc,
        extensions: [latexCitationHoverTooltip],
      });
      const view = new EditorView({ state });

      // Hover over second key: 'nguyen2024ai'
      const hoverPos2 = doc.indexOf('nguyen2024ai') + 2;
      const tooltip2 = (latexCitationHoverTooltip as any).source(view, hoverPos2, 1);

      expect(tooltip2).not.toBeNull();
      const dom2 = tooltip2.create().dom;
      expect(dom2.textContent).toContain('@nguyen2024ai');
      expect(dom2.textContent).toContain('Nguyễn Văn An & Trần Thị Bình');

      // Hover over first key: 'vaswani2017attention'
      const hoverPos1 = doc.indexOf('vaswani2017attention') + 2;
      const tooltip1 = (latexCitationHoverTooltip as any).source(view, hoverPos1, 1);

      expect(tooltip1).not.toBeNull();
      const dom1 = tooltip1.create().dom;
      expect(dom1.textContent).toContain('@vaswani2017attention');
      expect(dom1.textContent).toContain('Attention Is All You Need');

      view.destroy();
    });

    it('triggers tooltip when hovering over Pandoc [@key] and inline @key', () => {
      const doc = 'Phương pháp học sâu [@nguyen2024ai; @vaswani2017attention] và mô hình @nguyen2024ai rất hữu ích.';
      const state = EditorState.create({
        doc,
        extensions: [latexCitationHoverTooltip],
      });
      const view = new EditorView({ state });

      // Hover over bracketed @vaswani2017attention
      const pos1 = doc.indexOf('@vaswani2017attention') + 3;
      const tooltip1 = (latexCitationHoverTooltip as any).source(view, pos1, 1);
      expect(tooltip1).not.toBeNull();
      expect(tooltip1.create().dom.textContent).toContain('Attention Is All You Need');

      // Hover over inline @nguyen2024ai
      const pos2 = doc.lastIndexOf('@nguyen2024ai') + 3;
      const tooltip2 = (latexCitationHoverTooltip as any).source(view, pos2, 1);
      expect(tooltip2).not.toBeNull();
      expect(tooltip2.create().dom.textContent).toContain('Nguyễn Văn An & Trần Thị Bình');

      view.destroy();
    });

    it('renders warning card and picker button for unresolved citation keys', () => {
      const doc = 'Trích dẫn chưa có trong thư viện \\cite{unknownKey2025}.';
      const state = EditorState.create({
        doc,
        extensions: [latexCitationHoverTooltip],
      });
      const view = new EditorView({ state });

      const hoverPos = doc.indexOf('unknownKey2025') + 2;
      const tooltip = (latexCitationHoverTooltip as any).source(view, hoverPos, 1);

      expect(tooltip).not.toBeNull();
      const dom = tooltip.create().dom;
      expect(dom.textContent).toContain('Chưa tìm thấy');
      expect(dom.textContent).toContain('@unknownKey2025');
      expect(dom.textContent).toContain('Ctrl+Shift+K');
      expect(dom.textContent).toContain('Mở Citation Picker');

      // Test button click opens citation picker
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const btn = dom.querySelector('button');
      expect(btn).not.toBeNull();
      btn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'citation-picker',
      });

      view.destroy();
    });
  });
});
