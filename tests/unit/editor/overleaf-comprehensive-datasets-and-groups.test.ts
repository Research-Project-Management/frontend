/**
 * overleaf-comprehensive-datasets-and-groups.test.ts
 *
 * Comprehensive Overleaf Benchmark Datasets (DS-1..DS-5), Power-User Utilities (CS-U1..CS-U4),
 * Multi-User Group Workflows (CS-G1..CS-G3), Engineering Best Practices (CS-BP1..CS-BP3),
 * Extreme Edge Cases (CS-E1..CS-E3), and Quantitative SLO Threshold Gates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { LatexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { LatexSymbolsIndexCore } from '@/features/editor/domain/latex/latex-symbols-core';
import { parseBibContent } from '@/features/editor/subsystems/citation/model/bib-parser';
import {
  refactorCitationKeyAcrossFiles,
  validateCitationKey,
} from '@/features/editor/subsystems/citation/model/citation-refactor';
import {
  parseLatexLog,
  filterDiagnostics,
} from '@/features/editor/subsystems/compiler';
import { parseTableToLatex } from '@/features/editor/domain/latex/smart-paste';
import { parseLatexTabular } from '@/features/editor/domain/latex/table-matrix';
import {
  countLatexWords,
} from '@/features/editor/domain/document/word-count';
import {
  performRecursiveXyCut,
  type PdfTextItem,
} from '@/features/editor/subsystems/compiler/synctex/xy-cut';
import {
  parseDocumentOutline,
} from '@/features/editor/subsystems/compiler/synctex/pdf-outline';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import { extractMentions } from '@/features/editor/domain/collaboration/mention';
import { sanitizeZipPath, detectCommonRootPrefix } from '@/features/editor/sdk/archive/archive-import';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { TikZTranspiler } from '@/features/editor/domain/canvas/tikz-transpiler';

describe('Overleaf Comprehensive Datasets, Group Workflows, Edge Cases & SLO Gates', () => {
  beforeEach(() => {
    lruDocumentCache.clear();
  });

  // ===========================================================================
  // 1. DS-1: Multi-Chapter PhD Dissertation (50+ files, 3-level nesting, 500+ labels, 400+ BibTeX)
  // ===========================================================================
  describe('DS-1: Multi-Chapter PhD Dissertation Benchmark & SLO Gate', () => {
    it('constructs 52-file 3-level nested PhD thesis DAG and indexes 500+ labels & 400+ BibTeX entries within SLO', () => {
      const dag = new LatexDagEngine();
      const symbolsIndex = new LatexSymbolsIndexCore();

      const files: Array<{ id: string; path: string; content: string }> = [];

      // Root dissertation file
      const chapterIncludes: string[] = [];
      for (let c = 1; c <= 12; c++) {
        chapterIncludes.push(`\\include{chapters/ch${c}/main}`);
      }
      const rootContent = [
        '\\documentclass[12pt,twoside]{report}',
        '\\usepackage{amsmath,amssymb,graphicx,hyperref,natbib}',
        '\\input{frontmatter/macros}',
        '\\input{frontmatter/acknowledgments}',
        '\\begin{document}',
        ...chapterIncludes,
        '\\appendix',
        '\\include{appendices/proofs}',
        '\\bibliography{refs/core,refs/systems,refs/theory}',
        '\\end{document}',
      ].join('\n');

      files.push({ id: 'root-main', path: 'main.tex', content: rootContent });
      files.push({
        id: 'fm-macros',
        path: 'frontmatter/macros.tex',
        content: '\\newcommand{\\R}{\\mathbb{R}}\n\\newcommand{\\E}{\\mathbb{E}}',
      });
      files.push({
        id: 'fm-ack',
        path: 'frontmatter/acknowledgments.tex',
        content: '\\chapter*{Acknowledgments}\nWe thank the research committee.',
      });

      // 12 chapters, each with main.tex + 3 nested sub-sections = 48 chapter files
      let labelCounter = 0;
      for (let c = 1; c <= 12; c++) {
        const subInputs: string[] = [];
        for (let s = 1; s <= 3; s++) {
          const subPath = `chapters/ch${c}/sec${s}.tex`;
          subInputs.push(`\\input{chapters/ch${c}/sec${s}}`);

          const labelsBlock: string[] = [
            `\\section{Chapter ${c} Section ${s}}`,
            `\\label{sec:ch${c}_s${s}}`,
          ];
          for (let l = 1; l <= 14; l++) {
            labelCounter++;
            labelsBlock.push(
              `\\begin{equation}\\label{eq:thm_${c}_${s}_${l}} x_{${labelCounter}} = \\alpha_{${l}} + \\beta_{${c}} \\end{equation}`,
              `As shown in Equation~\\eqref{eq:thm_${c}_${s}_${l}} and \\cite{author_${(labelCounter % 400) + 1}_2024}, the bound holds.`,
            );
          }
          files.push({
            id: `ch-${c}-sec-${s}`,
            path: subPath,
            content: labelsBlock.join('\n'),
          });
        }

        files.push({
          id: `ch-${c}-main`,
          path: `chapters/ch${c}/main.tex`,
          content: [`\\chapter{Chapter ${c}: Deep Architecture}`, `\\label{ch:${c}}`, ...subInputs].join('\n'),
        });
      }

      files.push({
        id: 'app-proofs',
        path: 'appendices/proofs.tex',
        content: '\\chapter{Formal Proofs}\\label{app:proofs}\nSee Chapter~\\ref{ch:1} and Section~\\ref{sec:ch12_s3}.',
      });

      // Generate 420 BibTeX entries
      const bibEntriesRaw: string[] = [];
      for (let b = 1; b <= 420; b++) {
        bibEntriesRaw.push(
          `@inproceedings{author_${b}_2024,\n  author = {Researcher, Alice and Scientist, Bob},\n  title = {{Scalable Distributed Systems Part ${b}}},\n  booktitle = {Proceedings of NeurIPS},\n  year = {2024},\n  doi = {10.1000/neurips.2024.${b}}\n}`,
        );
      }
      const massiveBibContent = bibEntriesRaw.join('\n\n');

      const startTime = performance.now();

      for (const f of files) {
        dag.parseAndRegister(f.path, f.content);
        symbolsIndex.indexFile(f.id, f.path, f.content);
      }
      const parsedBib = parseBibContent(massiveBibContent);

      const elapsedMs = performance.now() - startTime;

      // Verify scale invariants
      expect(files.length).toBeGreaterThanOrEqual(52);
      expect(labelCounter).toBeGreaterThanOrEqual(500);
      expect(parsedBib.length).toBe(420);

      // Verify DAG root inference and reachability
      const inferredRoot = dag.inferRootDocument('chapters/ch12/sec3.tex');
      expect(inferredRoot.rootPath).toBe('main.tex');
      expect(inferredRoot.hasCycleWarning).toBe(false);

      const allLabels = symbolsIndex.exportSnapshot().labels;
      expect(allLabels.length).toBeGreaterThanOrEqual(550);

      // Verify SLO threshold (< 350ms in CI/Node environment for full 52-file + 420-bib indexing)
      expect(elapsedMs).toBeLessThan(350);

      // Verify incremental single-file re-indexing SLO (< 15ms)
      const incStart = performance.now();
      symbolsIndex.indexFile(
        'ch-1-sec-1',
        'chapters/ch1/sec1.tex',
        '\\section{Updated}\\label{sec:ch1_s1_new}\\begin{equation}\\label{eq:new_bound} y = mx + b \\end{equation}',
      );
      const incElapsed = performance.now() - incStart;
      expect(incElapsed).toBeLessThan(15);
      expect(
        symbolsIndex.exportSnapshot().labels.some((l) => l.name === 'eq:new_bound'),
      ).toBe(true);
    });
  });

  // ===========================================================================
  // 2. DS-2 & CS-U2: Heavy Math, TikZ/PGFPlots & Smart Paste
  // ===========================================================================
  describe('DS-2 & CS-U2: Heavy Math, TikZ Transpiler & Smart Paste', () => {
    it('CS-U2: converts 50x8 experimental TSV spreadsheet with special LaTeX chars into valid tabular matrix', () => {
      const header = ['Model_Name', 'Dataset & Split', 'Accuracy (%)', 'Loss #1', 'p-value', 'Latency (ms)', 'Memory_GB', 'Notes'];
      const rows: string[] = [header.join('\t')];
      for (let r = 1; r <= 50; r++) {
        rows.push(
          [
            `FluxNet_v${r}`,
            `ImageNet_100%`,
            `${(92 + (r % 7) * 0.5).toFixed(2)}%`,
            `0.0${r}#1`,
            `$p < 0.001$`,
            `${12 + r}`,
            `16_GB`,
            `Run & Verify $${r}$`,
          ].join('\t'),
        );
      }
      const rawTsv = rows.join('\n');
      const mockClipboard = {
        getData: (format: string) => (format === 'text/plain' ? rawTsv : ''),
      } as unknown as DataTransfer;

      const latexTable = parseTableToLatex(mockClipboard, {
        caption: '50-Run Benchmark Evaluation',
        label: 'tab:fluxnet_50',
      });
      expect(latexTable).toBeDefined();
      expect(latexTable).toContain('\\begin{table}');
      expect(latexTable).toContain('\\begin{tabular}');
      // Special characters outside math should be escaped
      expect(latexTable).toContain('\\%');
      expect(latexTable).toContain('\\#1');
      expect(latexTable).toContain('FluxNet\\_v1');

      const parsedMatrix = parseLatexTabular(latexTable!);
      expect(parsedMatrix).not.toBeNull();
      expect(parsedMatrix!.cols).toBe(8);
      expect(parsedMatrix!.data.length).toBe(50);
    });

    it('transpiles complex multi-node TikZ architecture diagram accurately', () => {
      const code = TikZTranspiler.transpile([
        {
          id: 'encoder',
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 120,
          height: 50,
          text: 'Encoder & Attention',
          strokeColor: '#1e40af',
          fillColor: '#dbeafe',
        },
        {
          id: 'decoder',
          type: 'rectangle',
          x: 320,
          y: 100,
          width: 120,
          height: 50,
          text: 'Decoder_Layer #1',
          strokeColor: '#065f46',
          fillColor: '#d1fae5',
        },
      ]);

      expect(code).toContain('\\begin{tikzpicture}');
      expect(code).toContain('Encoder \\& Attention');
      expect(code).toContain('Decoder\\_Layer \\#1');
      expect(code).toContain('\\end{tikzpicture}');
    });
  });

  // ===========================================================================
  // 3. DS-3: Multilingual UTF-8 (Vietnamese, CJK, European Accents) & Word Count
  // ===========================================================================
  describe('DS-3: Multilingual Academic Manuscript (Vietnamese + CJK + Math)', () => {
    it('accurately counts words, parses outline, and preserves UTF-8 diacritics without byte/code-unit drift', () => {
      const vietnameseLatex = [
        '\\documentclass{article}',
        '\\usepackage[utf8]{inputenc}',
        '\\usepackage[vietnamese]{babel}',
        '\\title{Mô Hình Học Sâu Cho Xử Lý Ngôn Ngữ Tự Nhiên Tiếng Việt}',
        '\\begin{document}',
        '\\section{Giới Thiệu \\& Động Lực Nghiên Cứu}',
        'Trong bài báo này, chúng tôi đề xuất kiến trúc mạng nơ-ron biến đổi (Transformer) tối ưu hóa cho tiếng Việt và tiếng Nhật (深層学習モデル).',
        '\\[ \\mathcal{L}_{\\text{tổng}} = \\sum_{i=1}^{N} -\\log P(y_i \\mid x_i; \\theta) \\]',
        '\\subsection{Đánh Giá Thực Nghiệm Trên Tập Dữ Liệu Lớn}',
        'Kết quả thực nghiệm cho thấy độ chính xác tăng vượt trội theo công trình \\cite{nguyen2025phobert}.',
        '\\end{document}',
      ].join('\n');

      const outline = parseDocumentOutline(vietnameseLatex);
      expect(outline).toHaveLength(2);
      expect(outline[0].title).toBe('Giới Thiệu & Động Lực Nghiên Cứu');
      expect(outline[1].title).toBe('Đánh Giá Thực Nghiệm Trên Tập Dữ Liệu Lớn');

      const stats = countLatexWords(vietnameseLatex);
      expect(stats.totalWords).toBeGreaterThan(25);
      expect(stats.headers).toBeGreaterThan(0);
      expect(stats.mathDisplayed + stats.mathInlines).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 4. CS-U3 & CS-U4: Two-Column SyncTeX XY-Cut & Project-Wide Citation Refactoring
  // ===========================================================================
  describe('CS-U3 & CS-U4: Two-Column PDF XY-Cut Layout & Project-Wide Citation Refactoring', () => {
    it('CS-U3: separates left and right columns in IEEE two-column PDF layout via recursive XY-Cut', () => {
      const items: PdfTextItem[] = [];
      // Left column (x: 60..260), Right column (x: 320..520)
      for (let line = 0; line < 30; line++) {
        items.push({
          str: `Left column line ${line}`,
          x: 60,
          y: 100 + line * 14,
          w: 200,
          h: 10,
        });
        items.push({
          str: `Right column line ${line}`,
          x: 320,
          y: 100 + line * 14,
          w: 200,
          h: 10,
        });
      }

      const layout = performRecursiveXyCut(items, { pageWidth: 595, pageHeight: 842 });
      expect(layout.columnCount).toBe(2);
      // Verify all 30 left column items precede right column items in reading order
      expect(layout.orderedItems[0].str).toBe('Left column line 0');
      expect(layout.orderedItems[29].str).toBe('Left column line 29');
      expect(layout.orderedItems[30].str).toBe('Right column line 0');
    });

    it('CS-U4: refactors citation key across multi-citation commands without corrupting prefix/suffix keys', () => {
      const projectFiles = [
        {
          id: 'f1',
          path: 'intro.tex',
          content:
            'Prior work \\cite{vaswani2017,vaswani2017_ext,devlin2019} and \\citet[see][p.~12]{vaswani2017} established this.',
        },
        {
          id: 'f2',
          path: 'methods.tex',
          content: 'We compare against \\citep{lecun2015, vaswani2017, brown2020}.',
        },
      ];

      expect(validateCitationKey('vaswani2017attention', 'vaswani2017').isValid).toBe(true);
      const refactored = refactorCitationKeyAcrossFiles(
        projectFiles,
        'vaswani2017',
        'vaswani2017attention',
      );

      expect(refactored.totalCount).toBe(3);
      // Must NOT corrupt `vaswani2017_ext`
      expect(refactored.modifiedFiles[0].newContent).toContain('vaswani2017_ext');
      expect(refactored.modifiedFiles[0].newContent).toContain(
        '\\cite{vaswani2017attention,vaswani2017_ext,devlin2019}',
      );
      expect(refactored.modifiedFiles[0].newContent).toContain(
        '\\citet[see][p.~12]{vaswani2017attention}',
      );
      expect(refactored.modifiedFiles[1].newContent).toContain(
        '\\citep{lecun2015, vaswani2017attention, brown2020}',
      );
    });
  });

  // ===========================================================================
  // 5. CS-G1 & CS-G2: Multi-User Group Workflows (12-User Yjs CRDT Sprint & Review)
  // ===========================================================================
  describe('CS-G1 & CS-G2: 12-User Concurrent Yjs CRDT Deadline Sprint & Review Mentions', () => {
    it('CS-G1: converges 100% identically across 12 concurrent collaborators performing 600 interleaved edits with zero lost characters', () => {
      const serverDoc = new Y.Doc();
      const serverText = serverDoc.getText('codemirror');
      const baseline = '\\section{Introduction}\nInitial shared baseline paragraph.\n';
      serverText.insert(0, baseline);

      // Spawn 12 collaborator Y.Docs synced to baseline
      const clients = Array.from({ length: 12 }, (_, idx) => {
        const doc = new Y.Doc();
        doc.clientID = 1000 + idx;
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(serverDoc));
        return { id: `user-${idx + 1}`, doc, text: doc.getText('codemirror') };
      });

      const pendingUpdates: Uint8Array[] = [];
      let expectedInsertedChars = 0;

      // Each of the 12 collaborators performs 50 concurrent edits (total 600 operations)
      for (let round = 0; round < 50; round++) {
        for (let c = 0; c < clients.length; c++) {
          const client = clients[c];
          const token = `<u${c + 1}:r${round}>`;
          expectedInsertedChars += token.length;
          const len = client.text.length;
          const pos = (round * 7 + c * 13) % Math.max(1, len);
          client.doc.transact(() => {
            client.text.insert(pos, token);
          });
          pendingUpdates.push(Y.encodeStateAsUpdate(client.doc));
        }
      }

      // Broadcast updates out-of-order (reverse order) to server and all clients
      for (let i = pendingUpdates.length - 1; i >= 0; i--) {
        Y.applyUpdate(serverDoc, pendingUpdates[i]);
      }
      const finalServerUpdate = Y.encodeStateAsUpdate(serverDoc);
      for (const client of clients) {
        Y.applyUpdate(client.doc, finalServerUpdate);
      }

      const canonicalText = serverText.toString();
      // 1. All 12 clients must converge to the exact same string
      for (const client of clients) {
        expect(client.text.toString()).toBe(canonicalText);
      }
      // 2. Total character count must equal baseline + all 600 inserted tokens (0 lost or duplicated characters)
      expect(canonicalText.length).toBe(baseline.length + expectedInsertedChars);
    });

    it('CS-G2: extracts @mentions from review discussion threads and computes accurate compilation snapshots', () => {
      const commentBody =
        'Hey @alice_nguyen and @prof.smith, please check Equation (4) before @bob-tran submits to ICML!';
      const mentions = extractMentions(commentBody);
      expect(mentions.map((m) => m.name)).toEqual(['alice_nguyen', 'prof.smith', 'bob-tran']);

      const snapshot = assembleCompilationSnapshot({
        resolvedMainFile: 'main.tex',
        baseFiles: [
          { id: '1', path: 'main.tex', content: '\\documentclass{article}\n\\input{sec1}\n\\begin{document}Hello\\end{document}' },
          { id: '2', path: 'sec1.tex', content: 'Section 1 baseline' },
        ],
        dirtyFiles: [{ fileId: '2', content: 'Section 1 live unsaved edit from collaborator' }],
      });

      expect(snapshot.files['sec1.tex']).toBe('Section 1 live unsaved edit from collaborator');
    });
  });

  // ===========================================================================
  // 6. CS-BP1..CS-BP3 & CS-E1..CS-E3: Atomic Tab Switching, Torture Corpus & Security Gates
  // ===========================================================================
  describe('CS-BP1..CS-BP3 & CS-E1..CS-E3: Best Practices, Chaos Torture Corpus & Security Gates', () => {
    it('CS-BP1: preserves dirty content across rapid 10-tab switching burst without data loss', () => {
      for (let i = 1; i <= 10; i++) {
        lruDocumentCache.registerModel(`doc-${i}`, {
          content: `Initial content for doc ${i}`,
          filePath: `chapters/doc-${i}.tex`,
          projectId: 'proj-rapid',
        });
      }

      for (let i = 1; i < 10; i++) {
        lruDocumentCache.updateContent(`doc-${i}`, `Dirty edited content in doc-${i}`, true);
        sessionCoordinator.switchTab(`doc-${i}`, `doc-${i + 1}`);
      }

      expect(lruDocumentCache.getStats().mruFileId).toBe('doc-10');

      // Verify all dirty edits remain intact and were never overwritten by empty editor state
      for (let i = 1; i < 10; i++) {
        const model = lruDocumentCache.getModel(`doc-${i}`);
        expect(model?.isDirty).toBe(true);
        expect(model?.content).toBe(`Dirty edited content in doc-${i}`);
      }
    });

    it('CS-E2: neutralizes Zip-Slip path traversal attacks and detects common root prefixes on archive import', () => {
      expect(sanitizeZipPath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeZipPath('/absolute/evil.tex')).toBe('absolute/evil.tex');
      expect(sanitizeZipPath('project-master/chapters/../main.tex')).toBe(
        'project-master/main.tex',
      );
      expect(sanitizeZipPath('project-master/chapters/intro.tex')).toBe(
        'project-master/chapters/intro.tex',
      );

      const prefix = detectCommonRootPrefix([
        'neurips-2026-template/main.tex',
        'neurips-2026-template/sections/intro.tex',
        'neurips-2026-template/refs.bib',
      ]);
      expect(prefix).toBe('neurips-2026-template/');
    });

    it('CS-E3 & DS-5: survives cyclic \\input graphs and parses 5,000-line compiler log within <100ms SLO', () => {
      // 1. Cyclic \input graph resilience (a.tex -> b.tex -> c.tex -> a.tex)
      const dag = new LatexDagEngine();
      dag.parseAndRegister('a.tex', '\\documentclass{article}\\input{b.tex}');
      dag.parseAndRegister('b.tex', '\\input{c.tex}');
      dag.parseAndRegister('c.tex', '\\input{a.tex}');

      const inferred = dag.inferRootDocument();
      expect(inferred.rootPath).toBe('a.tex');
      expect(inferred.hasCycleWarning).toBe(true);

      // 2. 5,000-line TeX Live log parsing SLO (< 100ms)
      const logLines: string[] = [
        'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
        '(./main.tex',
        '(./sections/intro.tex',
      ];
      for (let i = 1; i <= 4950; i++) {
        logLines.push(`Package hyperref Info: bookmark level for unknown AtLine ${i}.`);
      }
      logLines.push(
        './sections/intro.tex:142: Undefined control sequence.',
        'l.142 \\unknownmacro',
        '                    {test}',
        'LaTeX Warning: Citation `missing_ref_2026\' on page 4 undefined on input line 188.',
        'Overfull \\hbox (18.42pt too wide) in paragraph at lines 210--215',
        '))',
      );
      const hugeLog = logLines.join('\n');

      const t0 = performance.now();
      const parsed = parseLatexLog(hugeLog);
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(100);
      expect(parsed.errors.some((d) => d.line === 142 && d.file === 'sections/intro.tex')).toBe(true);
      expect(parsed.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });
});
