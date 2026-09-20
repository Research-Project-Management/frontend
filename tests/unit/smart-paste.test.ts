import { describe, it, expect } from 'vitest';
import {
  escapeLatex,
  isTableData,
  parseTableToLatex,
  isImageData,
  generateFigureLatex,
} from '@/features/editor/utils/smart-paste.util';

// Mock helper to build a fake DataTransfer object
function createMockClipboard(data: {
  'text/plain'?: string;
  'text/html'?: string;
  items?: Array<{ type: string }>;
  files?: Array<{ type: string; name: string }>;
}): DataTransfer {
  return {
    getData: (format: string) => data[format as keyof typeof data] as string || '',
    items: (data.items || []).map((item) => ({
      type: item.type,
      kind: 'file',
      getAsFile: () => new File([''], 'test.png', { type: item.type }),
      getAsString: () => {},
      webkitGetAsEntry: () => null,
    })) as unknown as DataTransferItemList,
    files: (data.files || []).map((f) => new File([''], f.name, { type: f.type })) as unknown as FileList,
    types: Object.keys(data),
    clearData: () => {},
    setData: () => true,
    dropEffect: 'none',
    effectAllowed: 'uninitialized',
  } as unknown as DataTransfer;
}

describe('Smart Paste Utility', () => {
  describe('escapeLatex', () => {
    it('escapes special characters correctly', () => {
      expect(escapeLatex('Profit & Loss 100% with $50_fee #1')).toBe(
        'Profit \\& Loss 100\\% with \\$50\\_fee \\#1'
      );
      expect(escapeLatex('Special ~ and ^ characters')).toBe(
        'Special \\textasciitilde{} and \\textasciicircum{} characters'
      );
    });

    it('handles empty or null strings', () => {
      expect(escapeLatex('')).toBe('');
    });
  });

  describe('isTableData', () => {
    it('detects TSV plain text with at least 2 lines and tabs', () => {
      const clipboard = createMockClipboard({
        'text/plain': 'Header1\tHeader2\tHeader3\nVal1\tVal2\tVal3\n',
      });
      expect(isTableData(clipboard)).toBe(true);
    });

    it('rejects regular plain text without tabs', () => {
      const clipboard = createMockClipboard({
        'text/plain': 'This is just regular text\nAcross two lines.',
      });
      expect(isTableData(clipboard)).toBe(false);
    });

    it('detects HTML table markup', () => {
      const clipboard = createMockClipboard({
        'text/html': '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>',
      });
      expect(isTableData(clipboard)).toBe(true);
    });
  });

  describe('parseTableToLatex', () => {
    it('converts TSV to standard booktabs table', () => {
      const clipboard = createMockClipboard({
        'text/plain': 'Item\tQuantity\tPrice ($)\nApples\t10\t15%\nOranges\t5\t8%\n',
      });
      const latex = parseTableToLatex(clipboard, {
        caption: 'Fruit Inventory',
        label: 'tab:fruits',
      });

      expect(latex).toContain('\\begin{table}[htbp]');
      expect(latex).toContain('\\caption{Fruit Inventory}');
      expect(latex).toContain('\\label{tab:fruits}');
      expect(latex).toContain('\\begin{tabular}{c c c}');
      expect(latex).toContain('\\toprule');
      expect(latex).toContain('Item & Quantity & Price (\\$) \\\\');
      expect(latex).toContain('\\midrule');
      expect(latex).toContain('Apples & 10 & 15\\% \\\\');
      expect(latex).toContain('Oranges & 5 & 8\\% \\\\');
      expect(latex).toContain('\\bottomrule');
      expect(latex).toContain('\\end{tabular}');
      expect(latex).toContain('\\end{table}');
    });

    it('converts TSV with custom non-booktabs option', () => {
      const clipboard = createMockClipboard({
        'text/plain': 'A\tB\n1\t2\n',
      });
      const latex = parseTableToLatex(clipboard, {
        booktabs: false,
        alignment: 'left',
      });

      expect(latex).toContain('\\begin{tabular}{l l}');
      expect(latex).toContain('\\hline');
      expect(latex).not.toContain('\\toprule');
    });
  });

  describe('isImageData', () => {
    it('detects image in clipboard items', () => {
      const clipboard = createMockClipboard({
        items: [{ type: 'image/png' }],
      });
      expect(isImageData(clipboard)).toBe(true);
    });

    it('returns false when no image is present', () => {
      const clipboard = createMockClipboard({
        'text/plain': 'Just some text',
      });
      expect(isImageData(clipboard)).toBe(false);
    });
  });

  describe('generateFigureLatex', () => {
    it('generates standard LaTeX figure markup', () => {
      const fig = generateFigureLatex('my-chart.png', 'Performance Benchmark');
      expect(fig).toContain('\\begin{figure}[htbp]');
      expect(fig).toContain('\\centering');
      expect(fig).toContain('\\includegraphics[width=0.8\\linewidth]{my-chart.png}');
      expect(fig).toContain('\\caption{Performance Benchmark}');
      expect(fig).toContain('\\label{fig:my-chart}');
      expect(fig).toContain('\\end{figure}');
    });
  });
});
