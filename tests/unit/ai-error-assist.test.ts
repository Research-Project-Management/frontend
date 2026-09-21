import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { suggestLatexFix } from '@/features/editor/services/ai-error-assist.service';

describe('AI Error Assist Service', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Test network offline'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly provides heuristic fix for undefined control sequence of booktabs', async () => {
    const result = await suggestLatexFix({
      errorMessage: 'Undefined control sequence. \\toprule',
      errorLine: 12,
      detail: '\\toprule',
      surroundingCode: '\\begin{tabular}{cc}\n\\toprule\nA & B \\\\',
    });

    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('booktabs');
    expect(result.fixedSnippet).toContain('\\usepackage{booktabs}');
  });

  it('correctly provides heuristic fix for missing $ inserted', async () => {
    const result = await suggestLatexFix({
      errorMessage: 'Missing $ inserted',
      errorLine: 25,
      detail: '<inserted text> $',
      surroundingCode: 'Value is x_i',
    });

    expect(result.explanation).toContain('math mode');
    expect(result.fixedSnippet).toContain('$');
  });

  it('correctly provides heuristic fix for missing \\item', async () => {
    const result = await suggestLatexFix({
      errorMessage: "LaTeX Error: Something's wrong--perhaps a missing \\item",
      errorLine: 40,
      surroundingCode: '\\begin{itemize}\nThis is text without item\n\\end{itemize}',
    });

    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('item');
    expect(result.fixedSnippet).toContain('\\item');
  });

  it('correctly detects environment mismatch', async () => {
    const result = await suggestLatexFix({
      errorMessage: '\\begin{figure} ended by \\end{table}',
      errorLine: 55,
      surroundingCode: '\\begin{figure}\n\\includegraphics{pic.png}\n\\end{table}',
    });

    expect(result.confidence).toBe('high');
    expect(result.explanation).toContain('Mismatched environment');
    expect(result.fixedSnippet).toBe('\\end{figure}');
  });
});
