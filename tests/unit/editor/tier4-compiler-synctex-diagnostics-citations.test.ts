import { describe, it, expect } from 'vitest';
import {
  countLatexWords,
  countProjectLatexWords,
} from '@/features/editor/domain/document/word-count';
import { extractLatexWords } from '@/features/editor/core/engine/extensions/latex-spelling';
import {
  parseSyncTeX,
  getNodeBounds,
  pointToAabbDistSq,
  buildKdTree2D,
  searchKdTreeNearest,
  isBase64GzipSyncTeX,
  decompressSyncTeXData,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { parseLatexLog } from '@/features/editor/domain/latex/compiler-logs-parser';
import { fixLatexError } from '@/features/editor/domain/ai/ai-error-assist';
import { scanRetractedCitations } from '@/features/editor/subsystems/diagnostics/extensions/latex-linter-core';
import {
  sanitizeZipPath,
  detectCommonRootPrefix,
} from '@/features/editor/sdk/archive/archive-import';
import {
  extractProjectId,
  extractSpaceId,
  type Page,
} from '@/features/editor/domain/types/core.types';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { documentFacade } from '@/features/editor/core/coordinator/document.facade';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';

describe('Khối 2 / Tầng 4 Frontend — Compiler, SyncTeX, Diagnostics, Spelling & Citations', () => {
  describe('1. Word Count (TeXcount Parity)', () => {
    it('returns zeroed core metrics on blank source and excludes comments / %TC:ignore', () => {
      expect(countLatexWords('')).toEqual({
        wordsInText: 0,
        wordsInHeaders: 0,
        wordsInCaptions: 0,
        wordsInBibliography: 0,
        headers: 0,
        floats: 0,
        mathInlines: 0,
        mathDisplayed: 0,
        totalWords: 0,
        charactersWithSpaces: 0,
        charactersNoSpaces: 0,
      });

      const stats = countLatexWords(
        [
          '\\section{Introduction}',
          'Alpha beta $x + y$ gamma.',
          '% comment words skipped',
          '%TC:ignore',
          'Draft note ignored',
          '%TC:endignore',
          '\\begin{figure}\\caption{Sample plot}\\end{figure}',
        ].join('\n'),
      );
      expect(stats.headers).toBe(1);
      expect(stats.wordsInHeaders).toBe(1);
      expect(stats.wordsInText).toBe(3);
      expect(stats.mathInlines).toBe(1);
      expect(stats.wordsInCaptions).toBe(2);
      expect(stats.floats).toBe(1);
    });

    it('aggregates project word counts across multiple .tex and .bbl files with %TC:incbib', () => {
      const projectStats = countProjectLatexWords({
        'main.tex':
          '%TC:incbib\n\\documentclass{article}\n\\begin{document}\nOne two.\n\\end{document}',
        'chapters/methods.tex': '\\section{Methods}\nThree four five.',
        'main.bbl': '\\begin{thebibliography}{1}\\bibitem{a} Ref Title.\\end{thebibliography}',
      });
      expect(projectStats.wordsInText).toBe(5);
      expect(projectStats.wordsInHeaders).toBe(1);
      expect(projectStats.wordsInBibliography).toBeGreaterThan(0);
      expect(projectStats.includedFiles).toHaveLength(3);
    });
  });

  describe('2. Latex Spelling Word Extractor', () => {
    it('extracts prose and BibTeX title/abstract words while skipping macros, math, and keys', () => {
      const words = extractLatexWords(
        [
          '\\usepackage{graphicx}',
          '\\section{Overview}',
          'Clean prose here with $alpha + beta$ and \\cite{knuth1984}.',
          '@article{smith2024,',
          '  author = {Hidden AuthorKey},',
          '  title = {Visible Title Words},',
          '}',
        ].join('\n'),
      ).map((w) => w.word);

      expect(words).toContain('Overview');
      expect(words).toContain('Visible');
      expect(words).toContain('Title');
      expect(words).not.toContain('graphicx');
      expect(words).not.toContain('knuth1984');
      expect(words).not.toContain('AuthorKey');
    });
  });

  describe('3. SyncTeX Parser, Geometric Bounds & 2D k-d Tree', () => {
    it('computes AABB bounds and resolves nearest box via 2D k-d tree', () => {
      const nodeA = { page: 1, fileIndex: 1, file: 'main.tex', line: 10, x: 100, y: 200, w: 80, h: 12 };
      const nodeB = { page: 1, fileIndex: 1, file: 'main.tex', line: 35, x: 100, y: 500, w: 80, h: 12 };
      const bounds = getNodeBounds(nodeA);
      expect(bounds.minX).toBe(100);
      expect(bounds.maxX).toBe(180);
      expect(bounds.minY).toBe(188);
      expect(bounds.maxY).toBe(212);
      expect(pointToAabbDistSq(120, 205, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY)).toBe(0);

      const tree = buildKdTree2D([nodeA, nodeB]);
      const nearest = searchKdTreeNearest(tree, 110, 498);
      expect(nearest.bestNode?.line).toBe(35);
    });

    it('parses SyncTeX records and detects gzip payloads cleanly', async () => {
      const rawSync = [
        'SyncTeX Version:1',
        'Input:1:./main.tex',
        'Output:pdf',
        'Magnification:1000',
        'Unit:1',
        'X Offset:0',
        'Y Offset:0',
        'Content:',
        '{1',
        'h1,12:4718592,9437184:13107200,786432,0',
        '}1',
        'Postamble:',
      ].join('\n');

      expect(isBase64GzipSyncTeX(rawSync)).toBe(false);
      expect(await decompressSyncTeXData(rawSync)).toBe(rawSync);
      const map = parseSyncTeX(rawSync);
      expect(map.tagToPath.get(1)).toContain('main.tex');
      expect(map.pageToNodes.get(1)?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Diagnostics Log Parser, AI Error Fix & Retraction Guard', () => {
    it('parses TeX paren-tree compiler logs and suggests packages for undefined control sequences', () => {
      const parsed = parseLatexLog(
        [
          '(./chapters/intro.tex',
          '! Undefined control sequence.',
          'l.18 \\includegraphics{fig1.png}',
          ')',
        ].join('\n'),
      );
      expect(parsed.errors.length).toBeGreaterThanOrEqual(1);
      expect(parsed.errors[0].file).toContain('chapters/intro.tex');
      expect(parsed.errors[0].line).toBe(18);

      const fix = fixLatexError({
        errorMessage: '! Undefined control sequence.',
        errorLine: 18,
        surroundingCode: '\\includegraphics{fig1.png}',
      });
      expect(fix.fixedSnippet).toBe('\\usepackage{graphicx}');
      expect(fix.confidence).toBe('high');
    });

    it('scans cited keys case-insensitively for retracted literature', () => {
      const retractedMap = new Map([
        [
          'fraud2020',
          {
            title: 'Retracted Trial',
            nature: 'Retraction',
            reason: 'Fabricated data',
          },
        ],
      ]);
      const diags = scanRetractedCitations(
        'Results match \\citep{Fraud2020,valid2024}.',
        retractedMap,
      );
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe('warning');
      expect(diags[0].message).toContain('Retracted Trial');
    });
  });

  describe('5. Archive Path Security Helpers', () => {
    it('normalizes traversal segments and extracts shared root prefix', () => {
      expect(sanitizeZipPath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeZipPath('template/sub/../main.tex')).toBe('template/main.tex');
      expect(
        detectCommonRootPrefix(['paper-v1/main.tex', 'paper-v1/refs.bib']),
      ).toBe('paper-v1/');
      expect(detectCommonRootPrefix(['main.tex', 'paper-v1/refs.bib'])).toBe('');
    });
  });

  describe('6. Canonical spaceId & Personal Space Coordinates', () => {
    it('extracts spaceId across Personal Space documents and synchronizes usePageStore spaceType', () => {
      const personalPage = {
        id: 'doc-personal-1',
        title: 'main.tex',
        content: '\\documentclass{article}',
        status: 'draft',
        projectId: '',
        spaceId: 'user-space-1',
        author: { id: 'user-space-1', name: 'Author' },
        views: 0,
        lastAccessedAt: '2026-10-15T00:00:00Z',
        createdAt: '2026-10-15T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      } satisfies Page;

      expect(extractSpaceId(personalPage)).toBe('user-space-1');
      expect(extractProjectId(personalPage)).toBe('user-space-1');

      const store = usePageStore.getState();
      store.resetPageState();
      store.setWorkspaceContext({
        spaceId: 'user-space-1',
        projectId: null,
        workspaceTitle: 'Personal Paper',
      });
      expect(usePageStore.getState().spaceType).toBe('personal');
      expect(usePageStore.getState().projectId).toBe('');
      expect(usePageStore.getState().getSpaceId()).toBe('user-space-1');
      expect(usePageStore.getState().getProjectId()).toBe('user-space-1');

      store.setWorkspaceContext({
        spaceId: 'proj-space-2',
        projectId: 'proj-space-2',
        workspaceTitle: 'Team Paper',
      });
      expect(usePageStore.getState().spaceType).toBe('project');
      expect(usePageStore.getState().getSpaceId()).toBe('proj-space-2');
      expect(usePageStore.getState().getProjectId()).toBe('proj-space-2');
    });

    it('falls back to usePageStore.spaceId in documentFacade and workspaceCoordinator during Personal Space sessions', () => {
      workspaceCoordinator.resetAllState();
      const store = usePageStore.getState();
      store.setWorkspaceContext({
        spaceId: 'personal-user-space',
        projectId: null,
        workspaceTitle: 'Personal Paper',
      });
      expect(usePageStore.getState().projectId).toBe('');

      const resolved = documentFacade.resolveProjectContext();
      expect(resolved.projectId).toBe('personal-user-space');

      workspaceCoordinator.syncStructureItems([
        { id: 'doc-1', filename: 'main.tex', isFolder: false },
      ]);
      const scopedFiles = workspaceCoordinator.getProjectFiles('personal-user-space');
      expect(scopedFiles).toHaveLength(1);
      expect(scopedFiles[0]?.id).toBe('doc-1');

      workspaceCoordinator.resetAllState();
    });
  });
});
