import { describe, it, expect } from 'vitest';
import {
  isTableData,
  parseTableToLatex,
} from '@/features/editor/domain/latex/smart-paste';

describe('Overleaf 1:1 Parity Visual Mode Enhancements', () => {
  describe('Smart Paste (Excel / TSV to LaTeX Tabular)', () => {
    it('detects and converts tab-separated values into LaTeX table', () => {
      const tsvData = 'Name\tScore\tRank\nAlice\t98\t1\nBob\t92\t2';
      const mockClipboard = {
        getData: (format: string) => {
          if (format === 'text/plain') return tsvData;
          return '';
        },
      } as unknown as DataTransfer;

      expect(isTableData(mockClipboard)).toBe(true);

      const latex = parseTableToLatex(mockClipboard, {
        caption: 'Student Results',
        label: 'tab:results',
      });

      expect(latex).toContain('\\begin{table}[htbp]');
      expect(latex).toContain('\\caption{Student Results}');
      expect(latex).toContain('\\begin{tabular}{c c c}');
      expect(latex).toContain('Alice & 98 & 1');
      expect(latex).toContain('\\bottomrule');
    });
  });
});
