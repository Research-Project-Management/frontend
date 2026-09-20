import { describe, it, expect } from 'vitest';
import {
  lintUnmatchedBraces,
  lintEnvironments,
  lintSpecialCharacters,
  lintInlineMath,
  lintLabelsAndReferences,
  lintCommandsAndTypos,
  lintRetractedCitations,
  runLatexLinter,
  type RetractedItemInfo,
  type LatexLintDiagnostic,
} from '@/features/editor/utils/latex-linter.util';

describe('LaTeX Syntax & Structural Diagnostics Engine (Overleaf Parity)', () => {
  describe('1. Unmatched Curly Braces {}', () => {
    it('should flag unclosed opening brace {', () => {
      const input = '\\section{Introduction\nThis is text.';
      const diags = lintUnmatchedBraces(input);

      const unclosed = diags.find((d: LatexLintDiagnostic) => d.code === 'UNCLOSED_OPENING_BRACE');
      expect(unclosed).toBeDefined();
      expect(unclosed?.startLineNumber).toBe(1);
    });

    it('should flag unmatched closing brace }', () => {
      const input = 'This is text with extra brace } here.';
      const diags = lintUnmatchedBraces(input);

      const extra = diags.find((d: LatexLintDiagnostic) => d.code === 'UNMATCHED_CLOSING_BRACE');
      expect(extra).toBeDefined();
      expect(extra?.startLineNumber).toBe(1);
    });

    it('should ignore escaped braces \\{ and \\} and comments', () => {
      const input = 'Set: \\{ a, b \\} % comment with { unclosed brace\nValid: {ok}';
      const diags = lintUnmatchedBraces(input);

      expect(diags).toHaveLength(0);
    });
  });

  describe('2. LaTeX Environments (\\begin{} and \\end{})', () => {
    it('should flag unclosed environments', () => {
      const input = '\\begin{equation}\nE = mc^2\n';
      const diags = lintEnvironments(input);

      const unclosed = diags.find((d: LatexLintDiagnostic) => d.code === 'UNCLOSED_ENV');
      expect(unclosed).toBeDefined();
      expect(unclosed?.message).toContain('\\begin{equation}');
      expect(unclosed?.startLineNumber).toBe(1);
    });

    it('should flag mismatched environments', () => {
      const input = '\\begin{itemize}\n\\item Hello\n\\end{enumerate}';
      const diags = lintEnvironments(input);

      const mismatch = diags.find((d: LatexLintDiagnostic) => d.code === 'MISMATCHED_ENV');
      expect(mismatch).toBeDefined();
      expect(mismatch?.message).toContain('Mismatched environment');
      expect(mismatch?.suggestions).toContain('\\end{itemize}');
    });

    it('should flag extra \\end{} without matching \\begin{}', () => {
      const input = 'Some text\n\\end{table}';
      const diags = lintEnvironments(input);

      const extra = diags.find((d: LatexLintDiagnostic) => d.code === 'EXTRA_END_ENV');
      expect(extra).toBeDefined();
      expect(extra?.message).toContain('\\end{table}');
    });
  });

  describe('3. Unescaped Special Characters (%, _, &)', () => {
    it('should flag unescaped % after numbers or words (accidental line truncate)', () => {
      const input = 'Accuracy reached 95% on the test set.';
      const diags = lintSpecialCharacters(input);

      const pct = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_PERCENT');
      expect(pct).toBeDefined();
      expect(pct?.suggestions).toContain('\\%');
    });

    it('should ignore escaped \\%', () => {
      const input = 'Accuracy reached 95\\% on the test set.';
      const diags = lintSpecialCharacters(input);

      const pct = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_PERCENT');
      expect(pct).toBeUndefined();
    });

    it('should flag unescaped _ outside math mode', () => {
      const input = 'File user_controller.ts has bugs.';
      const diags = lintSpecialCharacters(input);

      const under = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_UNDERSCORE');
      expect(under).toBeDefined();
      expect(under?.suggestions).toContain('\\_');
    });

    it('should allow _ in math mode $x_1 + y_2$ and in \\cite{foo_bar}', () => {
      const input = 'Formula $x_1 + y_2 = z$ and cite \\cite{author_2024}.';
      const diags = lintSpecialCharacters(input);

      const under = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_UNDERSCORE');
      expect(under).toBeUndefined();
    });

    it('should flag unescaped & outside tabular/alignment environments', () => {
      const input = 'Research & Development team';
      const diags = lintSpecialCharacters(input);

      const amp = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_AMPERSAND');
      expect(amp).toBeDefined();
      expect(amp?.suggestions).toContain('\\&');
    });

    it('should allow & inside \\begin{tabular}', () => {
      const input = '\\begin{tabular}{cc}\nA & B \\\\\n\\end{tabular}';
      const diags = lintSpecialCharacters(input);

      const amp = diags.find((d: LatexLintDiagnostic) => d.code === 'UNESCAPED_AMPERSAND');
      expect(amp).toBeUndefined();
    });
  });

  describe('4. Inline Math Mode ($ count)', () => {
    it('should flag unclosed inline math $', () => {
      const input = 'Let $x = 5 be given.';
      const diags = lintInlineMath(input);

      const math = diags.find((d: LatexLintDiagnostic) => d.code === 'UNCLOSED_INLINE_MATH');
      expect(math).toBeDefined();
    });

    it('should pass closed inline math $x = 5$', () => {
      const input = 'Let $x = 5$ be given.';
      const diags = lintInlineMath(input);

      expect(diags).toHaveLength(0);
    });
  });

  describe('5. Duplicate Labels and Undefined References', () => {
    it('should flag duplicate \\label{} definitions', () => {
      const input = '\\section{A}\\label{sec:intro}\n\\section{B}\\label{sec:intro}';
      const diags = lintLabelsAndReferences(input);

      const dup = diags.find((d: LatexLintDiagnostic) => d.code === 'DUPLICATE_LABEL');
      expect(dup).toBeDefined();
    });

    it('should flag undefined \\ref{} when labels exist', () => {
      const input = '\\label{sec:first}\nSee section \\ref{sec:nonexistent}.';
      const diags = lintLabelsAndReferences(input);

      const undef = diags.find((d: LatexLintDiagnostic) => d.code === 'UNDEFINED_REFERENCE');
      expect(undef).toBeDefined();
      expect(undef?.message).toContain('sec:nonexistent');
    });
  });

  describe('6. Deprecated Commands and Command Typos', () => {
    it('should flag command typos like \\seciton and \\beging', () => {
      const input = '\\seciton{Results}\n\\beging{center}\n\\endd{center}';
      const diags = lintCommandsAndTypos(input);

      const sec = diags.find((d: LatexLintDiagnostic) => d.message.includes('\\section'));
      expect(sec).toBeDefined();
      expect(sec?.suggestions).toContain('\\section');

      const beg = diags.find((d: LatexLintDiagnostic) => d.message.includes('\\begin'));
      expect(beg).toBeDefined();
      expect(beg?.suggestions).toContain('\\begin');
    });

    it('should flag deprecated commands like \\bf and \\it', () => {
      const input = 'This is {\\bf bold} and {\\it italic}.';
      const diags = lintCommandsAndTypos(input);

      const bf = diags.find((d: LatexLintDiagnostic) => d.code === 'DEPRECATED_COMMAND');
      expect(bf).toBeDefined();
      expect(bf?.suggestions).toContain('\\textbf{...}');
    });
  });

  describe('7. Retracted Citations Detection', () => {
    const retractedMap = new Map<string, RetractedItemInfo>([
      [
        'wakefield1998',
        {
          title: 'Retracted Autism MMR Vaccine Paper',
          reason: 'Falsified data and unethical conduct',
          nature: 'retraction',
        },
      ],
    ]);

    it('should detect single LaTeX \\cite referencing a retracted paper', () => {
      const text = '\\section{Introduction}\nAs shown in \\cite{wakefield1998}, the findings were reported.';
      const diags = lintRetractedCitations(text, retractedMap);

      expect(diags).toHaveLength(1);
      expect(diags[0].code).toBe('RETRACTED_CITATION');
      expect(diags[0].severity).toBe('warning');
      expect(diags[0].message).toContain('wakefield1998');
    });
  });

  describe('8. Full runLatexLinter Integration', () => {
    it('should run all syntax and structural diagnostics together', () => {
      const content = `
        \\seciton{Introduction}
        The accuracy is 95% overall.
        \\begin{equation}
        y = Wx + b
      `;
      const results = runLatexLinter(content);

      expect(results.some((r: LatexLintDiagnostic) => r.code === 'COMMAND_TYPO')).toBe(true);
      expect(results.some((r: LatexLintDiagnostic) => r.code === 'UNESCAPED_PERCENT')).toBe(true);
      expect(results.some((r: LatexLintDiagnostic) => r.code === 'UNCLOSED_ENV')).toBe(true);
    });
  });
});

