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

      // Default: compiling ch1.tex resolves via its subfiles parent
      const inferredDefault = dag.inferRootDocument('chapters/ch1.tex');
      expect(inferredDefault.rootPath).toBe('main.tex');
      expect(inferredDefault.inferredBy).toBe('subfile-parent');

      // Opt-in standalone: ch1.tex compiled as its own root
      const inferredDirect = dag.inferRootDocument('chapters/ch1.tex', null, { subfileStandalone: true });
      expect(inferredDirect.rootPath).toBe('chapters/ch1.tex');
      expect(inferredDirect.inferredBy).toBe('subfile');

      // When compiling from main document, it should resolve main.tex
      const inferredMain = dag.inferRootDocument('main.tex');
      expect(inferredMain.rootPath).toBe('main.tex');

      // When active file is null, heuristic resolves main.tex
      const inferredGlobal = dag.inferRootDocument(null);
      expect(inferredGlobal.rootPath).toBe('main.tex');
    });

    it('falls back to child as root when subfiles parent is not in the project', () => {
      dag.updateFileNode('ch1-id', 'chapters/ch1.tex', '\\documentclass[../missing.tex]{subfiles}\n\\begin{document}x\\end{document}');
      const inferred = dag.inferRootDocument('chapters/ch1.tex');
      expect(inferred.rootPath).toBe('chapters/ch1.tex');
      expect(inferred.inferredBy).toBe('subfile');
    });
  });

  describe('1b. Include edge cases', () => {
    it('parses braceless \\input after a \\\\ line break and with newline before {', () => {
      const parsed = parseLatexDirectives('Line\\\\\\input defs\n\\input\n  {chapters/a}\n\\\\input notacmd', 'main.tex');
      expect(parsed.includedFiles).toContain('defs.tex');
      expect(parsed.includedFiles).toContain('chapters/a.tex');
      expect(parsed.includedFiles).not.toContain('notacmd.tex');
    });

    it('strips comments after \\\\\\\\% but keeps \\\\\\\\\\\\% (escaped percent after linebreak)', () => {
      const clean = stripLatexComments('a\\\\% gone\nb\\\\\\% kept');
      expect(clean).toBe('a\\\\\nb\\\\\\% kept');
    });

    it('does not add phantom root-relative edge when relative target exists', () => {
      dag.updateFileNode('m', 'main.tex', '\\documentclass{article}\\begin{document}\\input{chapters/ch1}\\end{document}');
      dag.updateFileNode('c', 'chapters/ch1.tex', '\\input{sec}');
      dag.updateFileNode('s', 'chapters/sec.tex', 'text');
      const ch1 = dag.getNode('chapters/ch1.tex')!;
      expect(ch1.includes).toEqual(['chapters/sec.tex']);
      expect(dag.getAffectedAncestors('chapters/sec.tex').has('main.tex')).toBe(true);
    });

    it('prefers root-relative target when it exists (TeX cwd semantics)', () => {
      dag.updateFileNode('c', 'chapters/ch1.tex', '\\input{sec}');
      dag.updateFileNode('s1', 'sec.tex', 'root');
      dag.updateFileNode('s2', 'chapters/sec.tex', 'rel');
      expect(dag.getNode('chapters/ch1.tex')!.includes).toEqual(['sec.tex']);
      expect(dag.getNode('chapters/sec.tex')!.inDegree).toBe(0);
    });
  });

  describe('3b. Root inference with non-standard preamble name', () => {
    it('picks the \\begin{document} file that inputs a \\documentclass preamble', () => {
      dag.updateFileNode('h', 'header.tex', '\\documentclass{article}\n\\usepackage{amsmath}');
      dag.updateFileNode('b', 'body.tex', '\\input{header}\n\\begin{document}\nHi\n\\end{document}');
      expect(dag.inferRootDocument(null).rootPath).toBe('body.tex');
      expect(dag.inferRootDocument('header.tex').rootPath).toBe('body.tex');
      const analysis = dag.analyze();
      expect(analysis.rootCandidates).toContain('body.tex');
      expect(analysis.rootCandidates).not.toContain('header.tex');
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
