import { describe, it, expect, beforeEach } from 'vitest';
import {
  LatexDagEngine,
  normalizeLatexPath,
  resolveRelativeLatexPath,
  stripLatexComments,
  parseLatexDirectives,
} from '@/features/editor/domain/latex/latex-dag-engine';

describe('LatexDagEngine (Include Dependency Graph & Subfiles Parity)', () => {
  let dag: LatexDagEngine;

  beforeEach(() => {
    dag = new LatexDagEngine();
  });

  describe('1. Directive Parsing & Syntax Tolerance', () => {
    it('supports whitespace before brace in \\input and \\include', () => {
      const content = `
\\input {chapters/intro}
\\include  {chapters/methods}
\\subfile   {chapters/results}
`;
      const parsed = parseLatexDirectives(content, 'main.tex');
      expect(parsed.includedFiles).toContain('chapters/intro.tex');
      expect(parsed.includedFiles).toContain('chapters/methods.tex');
      expect(parsed.includedFiles).toContain('chapters/results.tex');
    });

    it('supports TeX primitive braceless \\input macro.tex', () => {
      const content = `
\\input macro.tex
\\input preamble
\\section{Hello}
`;
      const parsed = parseLatexDirectives(content, 'main.tex');
      expect(parsed.includedFiles).toContain('macro.tex');
      expect(parsed.includedFiles).toContain('preamble.tex');
    });

    it('correctly distinguishes escaped \\% from comment after double backslash \\\\%', () => {
      const text = `
Value 50\\% is kept % this is a comment
Row ends\\\\% another comment
Not a comment: \\% still here
`;
      const clean = stripLatexComments(text);
      expect(clean).toContain('50\\% is kept');
      expect(clean).toContain('Row ends\\\\');
      expect(clean).not.toContain('this is a comment');
      expect(clean).not.toContain('another comment');
    });
  });

  describe('2. Subfiles Standalone Compilation Parity', () => {
    it('resolves subfile as its own root when compiled directly', () => {
      dag.updateFileNode(
        'main-id',
        'main.tex',
        '\\documentclass{book}\n\\usepackage{subfiles}\n\\begin{document}\n\\subfile{chapters/ch1.tex}\n\\end{document}'
      );
      dag.updateFileNode(
        'ch1-id',
        'chapters/ch1.tex',
        '\\documentclass[../main.tex]{subfiles}\n\\begin{document}\n\\chapter{One}\nContent\n\\end{document}'
      );

      // When compiling ch1.tex directly, it should resolve ch1.tex as root (standalone subfile)
      const inferredDirect = dag.inferRootDocument('chapters/ch1.tex');
      expect(inferredDirect.rootPath).toBe('chapters/ch1.tex');
      expect(inferredDirect.inferredBy).toBe('subfile');

      // When compiling from main document, it should resolve main.tex
      const inferredMain = dag.inferRootDocument('main.tex');
      expect(inferredMain.rootPath).toBe('main.tex');

      // When active file is null, heuristic resolves main.tex
      const inferredGlobal = dag.inferRootDocument(null);
      expect(inferredGlobal.rootPath).toBe('main.tex');
    });
  });

  describe('3. Preamble Guarding when \\documentclass is in separate file', () => {
    it('selects main.tex over preamble.tex when \\documentclass is split into preamble.tex', () => {
      dag.updateFileNode(
        'preamble-id',
        'preamble.tex',
        '\\documentclass[12pt]{article}\n\\usepackage{amsmath}\n\\usepackage{graphicx}'
      );
      dag.updateFileNode(
        'main-id',
        'main.tex',
        '\\input{preamble.tex}\n\\begin{document}\nHello world!\n\\end{document}'
      );

      // Inferred root should be main.tex, NOT preamble.tex
      const inferred = dag.inferRootDocument(null);
      expect(inferred.rootPath).toBe('main.tex');

      // DAG analysis should list main.tex as rootCandidate, not preamble.tex
      const analysis = dag.analyze();
      expect(analysis.rootCandidates).toContain('main.tex');
      expect(analysis.rootCandidates).not.toContain('preamble.tex');
    });

    it('backtracks from child file to main.tex even when \\documentclass is in preamble.tex', () => {
      dag.updateFileNode(
        'preamble-id',
        'preamble.tex',
        '\\documentclass{report}\n\\usepackage{geometry}'
      );
      dag.updateFileNode(
        'main-id',
        'main.tex',
        '\\input{preamble.tex}\n\\begin{document}\n\\input{sections/sec1.tex}\n\\end{document}'
      );
      dag.updateFileNode(
        'sec1-id',
        'sections/sec1.tex',
        '\\section{Background}\nSome detailed notes.'
      );

      const inferred = dag.inferRootDocument('sections/sec1.tex');
      expect(inferred.rootPath).toBe('main.tex');
      expect(inferred.inferredBy).toBe('dag-backtracking');
    });
  });

  describe('4. Multi-level DAG & Cycle Detection', () => {
    it('detects circular includes', () => {
      dag.updateFileNode('f1', 'file1.tex', '\\input{file2.tex}');
      dag.updateFileNode('f2', 'file2.tex', '\\input{file1.tex}');

      const analysis = dag.analyze();
      expect(analysis.hasCycle).toBe(true);
      expect(analysis.cycles.length).toBeGreaterThan(0);
    });

    it('calculates blast radius / affected ancestors accurately', () => {
      dag.updateFileNode('root', 'main.tex', '\\input{chapters/ch1.tex}');
      dag.updateFileNode('ch1', 'chapters/ch1.tex', '\\input{sections/sec1.tex}');
      dag.updateFileNode('sec1', 'sections/sec1.tex', 'Text');

      const ancestors = dag.getAffectedAncestors('sections/sec1.tex');
      expect(ancestors.has('chapters/ch1.tex')).toBe(true);
      expect(ancestors.has('main.tex')).toBe(true);
      expect(ancestors.size).toBe(2);
    });
  });
});
