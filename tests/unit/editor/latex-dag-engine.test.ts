import { describe, it, expect, beforeEach } from 'vitest';
import {
  LatexDependencyGraph,
  normalizeLatexPath,
  resolveRelativeLatexPath,
  stripLatexComments,
  parseLatexDirectives,
} from '@/features/editor/domain/latex/dependency-graph';
import {
  LRUDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';
import { PrefixTrie } from '@/features/editor/domain/latex/prefix-trie';
import { LatexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';

describe('LatexDependencyGraph (Include Dependency Graph & Subfiles Parity)', () => {
  let dag: LatexDependencyGraph;

  beforeEach(() => {
    dag = new LatexDependencyGraph();
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

  describe('5. Stale Explicit Main File Protection (SSOT Guard)', () => {
    it('ignores missing ghost explicitMainFile when real TeX nodes exist in graph', () => {
      dag.setServerRootDoc('personal-notes.tex', 'doc-personal');
      dag.updateFileNode(
        'doc-personal',
        'personal-notes.tex',
        '\\documentclass{article}\n\\begin{document}\nHello notes\n\\end{document}',
      );

      const inferred = dag.inferRootDocument('doc-personal', 'flux.tex');
      expect(inferred.rootPath).toBe('personal-notes.tex');
      expect(inferred.rootFileId).toBe('doc-personal');
    });

    it('still honors unloaded explicitMainFile when it matches serverRootDocPath', () => {
      dag.setServerRootDoc('paper.tex', 'doc-paper');
      dag.updateFileNode('doc-ch1', 'sections/ch1.tex', '\\section{Chapter 1}\nBody.');

      const inferred = dag.inferRootDocument('doc-ch1', 'paper.tex');
      expect(inferred).toEqual({
        rootPath: 'paper.tex',
        rootFileId: 'doc-paper',
        inferredBy: 'explicit',
        hasCycleWarning: false,
      });
    });
  });

  describe('6. Path Helpers, Bounded LRU Eviction & Prefix-Trie Symbol Index', () => {
    it('normalizes and resolves relative LaTeX paths', () => {
      expect(normalizeLatexPath('chapters/intro.tex')).toBe('chapters/intro.tex');
      expect(normalizeLatexPath('chapters/intro')).toBe('chapters/intro.tex');
      expect(resolveRelativeLatexPath('figures', '../main.tex')).toBe('main.tex');
    });

    it('evicts least recently used model when LRUDocumentCache exceeds capacity and preserves view state', () => {
      const evicted: Array<{ fileId: string; model: DocumentModelState }> = [];
      const cache = new LRUDocumentCache();
      cache.setCapacity(3);
      cache.onEvict((fileId, model) => evicted.push({ fileId, model }));

      cache.registerModel('file1', { filePath: 'main.tex', content: 'Doc 1' });
      cache.registerModel('file2', { filePath: 'intro.tex', content: 'Doc 2' });
      cache.registerModel('file3', { filePath: 'methods.tex', content: 'Doc 3' });
      cache.getModel('file1'); // touch file1 -> MRU
      cache.registerModel('file4', { filePath: 'results.tex', content: 'Doc 4' });

      expect(cache.getStats().size).toBe(3);
      expect(cache.hasModel('file2')).toBe(false);
      expect(evicted.map((e) => e.fileId)).toEqual(['file2']);

      cache.updateViewState('file1', { anchor: 5, head: 5 }, { top: 120, left: 0 });
      expect(cache.getModel('file1')?.selection).toEqual({ anchor: 5, head: 5 });
      expect(cache.getModel('file1')?.scrollViewport).toEqual({ top: 120, left: 0 });
    });

    it('performs O(K) diacritic-normalized prefix lookups and resolves citations/labels in LatexSymbolsIndex', () => {
      const trie = new PrefixTrie<{ name: string }>();
      trie.insertNormalized('Nguyễn Văn An', { name: 'Nguyen Van An' });
      trie.insert('vaswani2017attention', { name: 'Citation Key' });
      trie.insert('test1', { name: 'Test 1' });
      trie.insert('test2', { name: 'Test 2' });
      trie.insert('test3', { name: 'Test 3' });

      expect(trie.findExact('vaswani2017attention')?.name).toBe('Citation Key');
      expect(trie.findPrefix('nguyen')[0]?.name).toBe('Nguyen Van An');
      expect(trie.findPrefix('Nguyễn')[0]?.name).toBe('Nguyen Van An');
      expect(trie.findPrefix('test', { limit: 2 })).toHaveLength(2);

      const index = new LatexSymbolsIndex();
      index.setLibraryCitations([
        {
          id: 'c1',
          citationKey: 'knuth1984texbook',
          title: 'The TeXbook',
          authors: [{ fullName: 'Donald E. Knuth' }],
          year: 1984,
        },
        {
          id: 'c2',
          citationKey: 'lamport1994latex',
          title: 'LaTeX: A Document Preparation System',
          authors: [{ fullName: 'Leslie Lamport' }],
          year: 1994,
        },
      ]);

      expect(index.getCitationByKey('knuth1984texbook')?.title).toBe('The TeXbook');
      expect(index.getCitations('lamport')).toHaveLength(1);
      index.indexFile(
        'main.tex',
        'main.tex',
        '\\label{sec:introduction}\n\\newcommand{\\customMacro}{foo}',
        true,
      );
      expect(index.getLabels('sec:').some((l) => l.name === 'sec:introduction')).toBe(true);
      expect(index.getLabels('introduction').some((l) => l.name === 'sec:introduction')).toBe(
        true,
      );
      index.dispose();
    });
  });
});
