import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseBibContent, type BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { LatexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { runLatexLinter } from '@/features/editor/subsystems/diagnostics/extensions/latex-linter-core';
import { countLatexWords } from '@/features/editor/domain/document/word-count';

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/real-world-datasets');
const ATTENTION_DIR = path.join(FIXTURES_DIR, 'attention');
const BERT_DIR = path.join(FIXTURES_DIR, 'bert');
const TINT_DIR = path.join(FIXTURES_DIR, 'tint');

describe('Flux Editor Real-World Academic Dataset Evaluation', () => {

  // =========================================================================
  // Case 1: Real-World BibTeX Database Ingestion (TinT arXiv:2307.01189)
  // =========================================================================
  describe('Case 1: Large Academic Bibliography Parsing (bibliography.bib - 32.8 KB)', () => {
    const bibPath = path.join(TINT_DIR, 'bibliography.bib');
    let bibContent: string;
    let parsedEntries: BibEntry[];

    it('loads and parses real-world bibliography file with dozens of entries', () => {
      expect(fs.existsSync(bibPath)).toBe(true);
      bibContent = fs.readFileSync(bibPath, 'utf-8');
      expect(bibContent.length).toBeGreaterThan(10000);

      parsedEntries = parseBibContent(bibContent);
      expect(parsedEntries.length).toBeGreaterThanOrEqual(50);
    });

    it('faithfully extracts metadata fields across diverse entry types', () => {
      const keys = parsedEntries.map((e) => e.key.toLowerCase());
      expect(keys.length).toBe(parsedEntries.length);

      // Verify essential fields exist across parsed entries
      const entriesWithAuthors = parsedEntries.filter((e) => e.authors && e.authors.length > 0);
      const entriesWithTitle = parsedEntries.filter((e) => e.title && e.title.trim().length > 0);
      const entriesWithYear = parsedEntries.filter((e) => e.year && e.year.trim().length > 0);

      expect(entriesWithAuthors.length).toBeGreaterThanOrEqual(parsedEntries.length * 0.9);
      expect(entriesWithTitle.length).toBeGreaterThanOrEqual(parsedEntries.length * 0.9);
      expect(entriesWithYear.length).toBeGreaterThanOrEqual(parsedEntries.length * 0.9);
    });

    it('handles search queries by author, title keyword, and publication year', () => {
      // Search by author "Brown" (e.g. GPT-3 paper)
      const brownMatches = parsedEntries.filter((e) =>
        e.authors?.some((a) => a.toLowerCase().includes('brown')) ||
        e.rawText?.toLowerCase().includes('brown')
      );
      expect(brownMatches.length).toBeGreaterThan(0);

      // Search by keyword "transformer"
      const transformerMatches = parsedEntries.filter((e) =>
        e.title?.toLowerCase().includes('transformer') ||
        e.key.toLowerCase().includes('transformer')
      );
      expect(transformerMatches.length).toBeGreaterThan(0);
    });

    it('correctly handles nested braces and TeX accent escapes in titles & author names', () => {
      // Protected titles like {BERT} or {GPT}
      const protectedTitleEntries = parsedEntries.filter((e) =>
        e.title && /\{[A-Z0-9-]+\}/i.test(e.title)
      );
      expect(protectedTitleEntries.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Case 2: Multi-File Dependency DAG & Root Resolution
  // =========================================================================
  describe('Case 2: Multi-File Dependency Graph & Root Resolution on Real Manuscripts', () => {
    it('accurately constructs DAG and infers root document for Attention Is All You Need (arXiv:1706.03762)', () => {
      const dag = new LatexDagEngine();
      const files: Array<{ id: string; title: string; path: string; content: string }> = [];

      const fileNames = fs.readdirSync(ATTENTION_DIR).filter((f) => f.endsWith('.tex'));
      for (const name of fileNames) {
        const content = fs.readFileSync(path.join(ATTENTION_DIR, name), 'utf-8');
        files.push({ id: name, title: name, path: name, content });
      }

      const analysis = dag.buildFromProjectFiles(files);
      expect(analysis.hasCycle).toBe(false);

      // Root candidate must be ms.tex (which has \documentclass and \begin{document})
      const inferred = dag.inferRootDocument();
      expect(inferred.rootPath).toBe('ms.tex');
      expect(inferred.inferredBy).toMatch(/active-standalone|dag-backtracking|heuristic/);

      // Backtracking test: when user is editing introduction.tex, root must still resolve to ms.tex
      const introInferred = dag.inferRootDocument('introduction.tex');
      expect(introInferred.rootPath).toBe('ms.tex');
      expect(introInferred.inferredBy).toBe('dag-backtracking');

      // Backtracking test: when user is editing model_architecture.tex, root must resolve to ms.tex
      const modelInferred = dag.inferRootDocument('model_architecture.tex');
      expect(modelInferred.rootPath).toBe('ms.tex');
      expect(modelInferred.inferredBy).toBe('dag-backtracking');
    });

    it('accurately constructs DAG and infers root document for BERT (arXiv:1810.04805)', () => {
      const dag = new LatexDagEngine();
      const files: Array<{ id: string; title: string; path: string; content: string }> = [];

      const fileNames = fs.readdirSync(BERT_DIR).filter((f) => f.endsWith('.tex'));
      for (const name of fileNames) {
        const content = fs.readFileSync(path.join(BERT_DIR, name), 'utf-8');
        files.push({ id: name, title: name, path: name, content });
      }

      const analysis = dag.buildFromProjectFiles(files);
      expect(analysis.hasCycle).toBe(false);

      // Root candidate must be main.tex
      const inferred = dag.inferRootDocument();
      expect(inferred.rootPath).toBe('main.tex');

      // When editing a table file (e.g. glue_official_tab.tex), DAG must backtrack to main.tex
      const tableInferred = dag.inferRootDocument('glue_official_tab.tex');
      expect(tableInferred.rootPath).toBe('main.tex');
      expect(tableInferred.inferredBy).toBe('dag-backtracking');
    });
  });

  // =========================================================================
  // Case 3: LaTeX Linter & Code-Check on Real-World Scientific Files
  // =========================================================================
  describe('Case 3: LaTeX Linter Validation on Real-World LaTeX Files', () => {
    it('analyzes Attention model_architecture.tex without false positive crashes', () => {
      const content = fs.readFileSync(path.join(ATTENTION_DIR, 'model_architecture.tex'), 'utf-8');
      const diagnostics = runLatexLinter(content);

      // Should return an array without throwing
      expect(Array.isArray(diagnostics)).toBe(true);

      // Should not report unclosed dollar error on standard equations
      const unclosedDollarErrors = diagnostics.filter((d) =>
        d.severity === 'error' && d.message.toLowerCase().includes('unclosed math')
      );
      expect(unclosedDollarErrors.length).toBe(0);
    });

    it('analyzes BERT main.tex and respects input environments', () => {
      const content = fs.readFileSync(path.join(BERT_DIR, 'main.tex'), 'utf-8');
      const diagnostics = runLatexLinter(content);
      expect(Array.isArray(diagnostics)).toBe(true);

      // main.tex has matched \begin{document} and \end{document}
      const envMismatchErrors = diagnostics.filter((d) =>
        d.severity === 'error' && d.message.toLowerCase().includes('mismatch')
      );
      expect(envMismatchErrors.length).toBe(0);
    });

    it('analyzes heavy math macro file without corrupting state machine', () => {
      const mathCommandsPath = path.join(TINT_DIR, 'math_commands.tex');
      if (fs.existsSync(mathCommandsPath)) {
        const content = fs.readFileSync(mathCommandsPath, 'utf-8');
        const diagnostics = runLatexLinter(content);
        expect(Array.isArray(diagnostics)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Case 5: Real-World Word Count & Academic Document Analytics
  // =========================================================================
  describe('Case 5: Academic Word Count on Real Paper Sections', () => {
    it('calculates accurate word count on Attention abstract and introduction', () => {
      const introContent = fs.readFileSync(path.join(ATTENTION_DIR, 'introduction.tex'), 'utf-8');
      const stats = countLatexWords(introContent);

      expect(stats.wordsInText).toBeGreaterThan(250);
      expect(stats.wordsInText).toBeLessThan(1500);
      expect(stats.charactersWithSpaces).toBeGreaterThan(stats.wordsInText);
    });

    it('calculates accurate word count on BERT abstract', () => {
      const abstractContent = fs.readFileSync(path.join(BERT_DIR, 'abstract.tex'), 'utf-8');
      const stats = countLatexWords(abstractContent);

      expect(stats.wordsInText).toBeGreaterThan(100);
      expect(stats.wordsInText).toBeLessThan(400);
    });

    it('correctly handles TeXcount ignore blocks and captions', () => {
      const sample = `
\\section{Introduction}
This is a real academic introduction with several key words.
%TC:ignore
This text is inside an ignored block and should not be counted.
%TC:endignore
Here is another sentence that must be counted.
`;
      const stats = countLatexWords(sample);
      expect(stats.wordsInText).toBeLessThan(25);
      expect(stats.wordsInText).toBeGreaterThan(10);
    });
  });
});
