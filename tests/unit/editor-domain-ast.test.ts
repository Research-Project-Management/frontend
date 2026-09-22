import { describe, it, expect } from 'vitest';
import {
  parseLatexStructure,
  getLineContext,
  formatContextForPrompt,
  type RichEditorContext,
} from '../../src/features/editor/domain/ast/latex-ast.parser';

describe('Domain: LaTeX AST Parser', () => {
  const sampleLatex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\begin{document}

\\section{Introduction}
\\label{sec:intro}
This is the intro with a citation \\cite{einstein1905}.

\\begin{equation}
E = mc^2
\\label{eq:emc}
\\end{equation}

\\subsection{Background}
Some background text here.

\\begin{figure}
\\centering
\\caption{Sample figure}
\\label{fig:sample}
\\end{figure}

\\end{document}`;

  it('parses sections with correct hierarchy and start lines', () => {
    const structure = parseLatexStructure(sampleLatex);
    expect(structure.sections).toHaveLength(2);
    expect(structure.sections[0]).toEqual({
      level: 'section',
      title: 'Introduction',
      startLine: 7,
    });
    expect(structure.sections[1]).toEqual({
      level: 'subsection',
      title: 'Background',
      startLine: 16,
    });
  });

  it('parses environments with start and end line bounds', () => {
    const structure = parseLatexStructure(sampleLatex);
    const eqEnv = structure.environments.find((e) => e.type === 'equation');
    expect(eqEnv).toBeDefined();
    expect(eqEnv?.startLine).toBe(11);
    expect(eqEnv?.endLine).toBe(14);

    const figEnv = structure.environments.find((e) => e.type === 'figure');
    expect(figEnv).toBeDefined();
    expect(figEnv?.startLine).toBe(19);
    expect(figEnv?.endLine).toBe(23);
  });

  it('extracts packages, labels, and citations', () => {
    const structure = parseLatexStructure(sampleLatex);
    expect(structure.packages).toContain('amsmath');
    expect(structure.packages).toContain('graphicx');
    expect(structure.labels).toContain('sec:intro');
    expect(structure.labels).toContain('eq:emc');
    expect(structure.labels).toContain('fig:sample');
    expect(structure.citations).toContain('einstein1905');
  });

  it('resolves active section and environment for a given line number', () => {
    const structure = parseLatexStructure(sampleLatex);
    // Line 12 is inside equation environment under Introduction section
    const ctx = getLineContext(12, structure);
    expect(ctx.section).toBe('\\section{Introduction}');
    expect(ctx.environment).toBe('equation');

    // Line 17 is inside Background subsection without active inner environment
    const ctx2 = getLineContext(17, structure);
    expect(ctx2.section).toBe('\\subsection{Background}');
    expect(ctx2.environment).toBeNull();
  });

  it('formats rich editor context into prompt-friendly text', () => {
    const structure = parseLatexStructure(sampleLatex);
    const richCtx: RichEditorContext = {
      filename: 'main.tex',
      totalLines: 26,
      selectedText: 'E = mc^2',
      hasSelection: true,
      startLine: 12,
      endLine: 12,
      selectedWordCount: 3,
      contextBefore: '\\begin{equation}',
      contextAfter: '\\end{equation}',
      currentSection: '\\section{Introduction}',
      currentEnvironment: 'equation',
      structure,
      cursorLine: 12,
      cursorCol: 5,
      cursorContext: 'E = mc^2',
    };

    const promptText = formatContextForPrompt(richCtx);
    expect(promptText).toContain('File: main.tex');
    expect(promptText).toContain('Current section: \\section{Introduction}');
    expect(promptText).toContain('Inside environment: \\begin{equation}');
    expect(promptText).toContain('E = mc^2');
  });
});
