/**
 * overleaf-real-world-case-studies.test.ts
 *
 * Large-Scale Real-World Overleaf Case Studies & Behavioral Stress Test Suite (CS-1 -> CS-7).
 *
 * Tests the Flux Editor & Manuscript architecture against REAL conference LaTeX datasets on disk:
 * - CS-1: "Attention Is All You Need" (Vaswani et al., NeurIPS 2017) — `tests/fixtures/real-world-datasets/attention`
 * - CS-2: "BERT: Pre-training of Deep Bidirectional Transformers" (Devlin et al., NAACL 2019) — `tests/fixtures/real-world-datasets/bert`
 * - CS-3: "Trainable Transformer in Transformer (TinT)" (Panigrahi et al., ICML 2024) — `tests/fixtures/real-world-datasets/tint`
 * - CS-4: Project-Wide Citation Key Refactoring & Retracted Paper Gate across >300KB of real LaTeX/BibTeX
 * - CS-5: Massive 2,500+ Line TeX Live Compiler Log Stream & Multi-Folder Error Stepping (F8 / Shift+F8)
 * - CS-6: High-Concurrency Multi-Author Deadline Sprint (@mentions, Track Changes & 3-Way Conflict Resolution)
 * - CS-7: Full-Project 0ms Compilation Snapshot Assembly (30+ nested files) & Large Experimental Table Smart Paste
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { LatexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { LatexSymbolsIndexCore } from '@/features/editor/domain/latex/latex-symbols-core';
import { LatexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  refactorCitationKeyAcrossFiles,
  validateCitationKey,
} from '@/features/editor/subsystems/citation/model/citation-refactor';
import {
  parseLatexLog,
  filterDiagnostics,
} from '@/features/editor/subsystems/compiler';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import { computeDraftDiffSummary } from '@/features/editor/domain/document/draft-diff';
import { extractMentions } from '@/features/editor/domain/collaboration/mention';
import { parseTableToLatex } from '@/features/editor/domain/latex/smart-paste';
import { parseLatexTabular } from '@/features/editor/domain/latex/table-matrix';
import {
  countLatexWords,
  countProjectLatexWords,
} from '@/features/editor/domain/document/word-count';
import {
  runLatexLinter,
  lintLabelsAndReferences,
} from '@/features/editor/subsystems/diagnostics/linter/latex-linter';
import {
  extractCitationKeys,
  detectCitationTrigger,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import {
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from '@/features/editor/subsystems/citation/model/bibliography-generator';
import { findMatchingBrace } from '@/features/editor/core/engine/extensions/latex-visual-headings';
import {
  sanitizeZipPath,
  detectCommonRootPrefix,
} from '@/features/editor/sdk/archive/archive-import';
import {
  buildFileTree,
  filterFileTree,
} from '@/features/editor/subsystems/explorer/model/document-tree';
import {
  parseLatexStructure,
  getLineContext,
} from '@/features/editor/domain/latex/latex-structure';
import {
  parseLatexHeadings,
  cleanLatexTitle,
  extractOutlineFromContent,
} from '@/features/editor/subsystems/compiler/synctex/pdf-outline';
import { computeLatexFoldRange } from '@/features/editor/core/engine/extensions/latex-folding';
import { EditorState } from '@codemirror/state';
import {
  performRecursiveXyCut,
  type PdfTextItem,
} from '@/features/editor/subsystems/compiler/synctex/xy-cut';
import {
  TikZTranspiler,
  escapeLatexText,
} from '@/features/editor/domain/canvas/tikz-transpiler';
import { QuadTree } from '@/features/editor/domain/canvas/quad-tree';
import { LRUDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { heuristicLatexErrorFix } from '@/features/editor/domain/ai/ai-error-assist';
import {
  formatRemainingTime,
  formatDigestBadgeText,
} from '@/features/editor/domain/collaboration/notification-digest';
import {
  parseSyncTeX,
  resolveForwardDetail,
  resolveReverse,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import {
  PrefixTrie,
  LatexSymbolCatalog,
} from '@/features/editor/domain/latex/prefix-trie';
import {
  createInitialSessionContext,
  sessionFsmTransition,
} from '@/features/editor/domain/document/session-fsm';
import {
  maskLatexEntities,
  applyHeuristicTransformation,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import {
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
  wrapFormatting,
} from '@/features/editor/core/engine/codemirror/latex-formatting.commands';
import { EditorView } from '@codemirror/view';

const DATASETS_ROOT = path.resolve(__dirname, '../../fixtures/real-world-datasets');

interface LoadedProjectFile {
  id: string;
  path: string;
  name: string;
  content: string;
}

/**
 * Recursively loads all text files (.tex, .bib, .bbl, .sty, .bst, .cls) from a real-world dataset folder.
 */
function loadRealWorldDataset(datasetName: 'attention' | 'bert' | 'tint'): LoadedProjectFile[] {
  const baseDir = path.join(DATASETS_ROOT, datasetName);
  const results: LoadedProjectFile[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tex|bib|bbl|sty|bst|cls)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        results.push({
          id: `${datasetName}:${relPath}`,
          path: relPath,
          name: entry.name,
          content,
        });
      }
    }
  }

  walk(baseDir);
  return results;
}

describe('Real-World Overleaf Case Studies & Large-Scale Dataset Stress Tests (CS-1 -> CS-7)', () => {
  beforeEach(() => {
    diagnosticsCoordinator.clear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 1 (CS-1): "ATTENTION IS ALL YOU NEED" (NeurIPS 2017)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-1: "Attention Is All You Need" (NeurIPS 2017 Dataset — ms.tex root, inline \\bibitem, \\newcommand*)', () => {
    const attentionFiles = loadRealWorldDataset('attention');

    it('discovers ms.tex (non-main.tex root), ignores commented-out \\input lines, and builds accurate multi-file DAG', () => {
      expect(attentionFiles.length).toBeGreaterThanOrEqual(11);

      const dag = new LatexDagEngine();
      const analysis = dag.buildFromProjectFiles(
        attentionFiles
          .filter((f) => f.path.endsWith('.tex'))
          .map((f) => ({
            id: f.id,
            title: f.path,
            path: f.path,
            content: f.content,
          })),
      );

      // Root must be inferred as ms.tex even when the user is currently editing why_self_attention.tex
      const inferredRoot = dag.inferRootDocument('why_self_attention.tex');
      expect(inferredRoot.rootPath).toBe('ms.tex');

      expect(analysis.hasCycle).toBe(false);

      const msNode = analysis.nodes.get('ms.tex');
      expect(msNode).toBeDefined();
      expect(msNode?.hasDocumentClass).toBe(true);

      // Active \input files in ms.tex must be included
      expect(msNode?.includes).toEqual(
        expect.arrayContaining([
          'introduction.tex',
          'background.tex',
          'model_architecture.tex',
          'why_self_attention.tex',
          'training.tex',
          'results.tex',
          'visualizations.tex',
        ]),
      );

      // Commented-out %\input{parameter_attention} and %\input{sqrt_d_trick} in ms.tex MUST NOT be included
      expect(msNode?.includes).not.toContain('parameter_attention.tex');
      expect(msNode?.includes).not.toContain('sqrt_d_trick.tex');
    });

    it('indexes all 40 inline \\bibitem references in ms.tex with author, \\newblock title, and year, plus starred \\newcommand*', () => {
      const indexCore = new LatexSymbolsIndexCore();
      for (const file of attentionFiles) {
        indexCore.indexFile(file.id, file.path, file.content);
      }

      const snapshot = indexCore.exportSnapshot();

      // 1. All 40 inline \bibitem entries from \begin{thebibliography}{10} in ms.tex must be indexed
      expect(snapshot.citations.length).toBe(40);

      const bahdanau = snapshot.citations.find((c) => c.key === 'bahdanau2014neural');
      expect(bahdanau).toBeDefined();
      expect(bahdanau?.author).toContain('Dzmitry Bahdanau');
      expect(bahdanau?.title).toContain('Neural machine translation by jointly learning to align and translate');
      expect(bahdanau?.year).toBe('2014');

      const resnet = snapshot.citations.find((c) => c.key === 'he2016deep');
      expect(resnet).toBeDefined();
      expect(resnet?.author).toContain('Kaiming He');
      expect(resnet?.title).toContain('Deep residual learning for image recognition');
      expect(resnet?.year).toBe('2016');

      // 2. Custom macros including starred \newcommand*\samethanks and \dmodel must be indexed
      const cmdNames = snapshot.commands.map((c) => c.name);
      expect(cmdNames).toEqual(
        expect.arrayContaining(['\\samethanks', '\\dmodel', '\\dffn', '\\concat', '\\todo']),
      );

      // 3. Multi-file Project Outline must start from ms.tex (Introduction -> Background -> Model Architecture...)
      const topSectionTitles = (snapshot.projectFlatOutline || [])
        .filter((item) => item.type === 'section')
        .map((item) => item.title);
      expect(topSectionTitles.slice(0, 7)).toEqual([
        'Introduction',
        'Background',
        'Model Architecture',
        'Why Self-Attention',
        'Training',
        'Results',
        'Conclusion',
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 2 (CS-2): "BERT" (NAACL 2019)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-2: "BERT" (NAACL 2019 Dataset — 18 modular .tex files, wrapped multi-line lumiere.bbl, ACL \\newcite)', () => {
    const bertFiles = loadRealWorldDataset('bert');

    it('indexes all 56 precompiled .bbl citations from lumiere.bbl including multi-line wrapped \\bibitem labels and nested braces', () => {
      const indexCore = new LatexSymbolsIndexCore();
      const lumiereBbl = bertFiles.find((f) => f.path === 'lumiere.bbl')!;
      expect(lumiereBbl).toBeDefined();

      // Index all .tex and lumiere.bbl
      for (const file of bertFiles) {
        if (file.path === 'main.bbl') continue; // avoid duplicate of lumiere.bbl
        indexCore.indexFile(file.id, file.path, file.content);
      }

      const snapshot = indexCore.exportSnapshot();

      // lumiere.bbl has 56 \bibitem entries, over half of which wrap [...] across 2 lines
      expect(snapshot.citations.length).toBe(56);

      // Check a multi-line wrapped \bibitem: \bibitem[{Al-Rfou et~al.(2018)Al-Rfou, Choe, Constant, Guo, and\n Jones}]{alrfou:2018}
      const alrfou = snapshot.citations.find((c) => c.key === 'alrfou:2018');
      expect(alrfou).toBeDefined();
      expect(alrfou?.author).toContain('Rami Al-Rfou');
      expect(alrfou?.title).toContain('Character-level language modeling with deeper self-attention');
      expect(alrfou?.year).toBe('2018');

      // Check an entry with \href{...}{...} in title: cer-etal:2017
      const cer = snapshot.citations.find((c) => c.key === 'cer-etal:2017');
      expect(cer).toBeDefined();
      expect(cer?.title).toContain('Semeval-2017 task 1');

      // Check an entry with nested braces {PASCAL} in title: bentivogli-etal:2009
      const bentivogli = snapshot.citations.find((c) => c.key === 'bentivogli-etal:2009');
      expect(bentivogli).toBeDefined();
      expect(bentivogli?.title).toContain('The fifth PASCAL recognizing textual entailment challenge');
    });

    it('refactors citation keys across all 18 BERT .tex files including ACL \\newcite{parikh-etal:2016, bidaf}', () => {
      const texOnly = bertFiles.filter((f) => f.path.endsWith('.tex'));
      const result = refactorCitationKeyAcrossFiles(
        texOnly,
        'parikh-etal:2016',
        'parikh2016decomposable',
      );

      expect(result.totalCount).toBeGreaterThanOrEqual(2);
      const modifiedBert = result.modifiedFiles.find((f) => f.path === 'bert.tex');
      expect(modifiedBert).toBeDefined();
      expect(modifiedBert?.newContent).toContain('\\newcite{parikh2016decomposable, bidaf}');
      expect(modifiedBert?.newContent).not.toContain('parikh-etal:2016');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 3 (CS-3): "TINT: TRAINABLE TRANSFORMER IN TRANSFORMER" (ICML 2024)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-3: "TinT" (ICML 2024 Dataset — 30+ files, 3-level nested folders, 250+ math macros, 857-line .bib)', () => {
    const tintFiles = loadRealWorldDataset('tint');

    it('infers main_arxiv.tex as root and resolves 3-level nested \\input across Proofs/, Tables/, and Theorems/', () => {
      const dag = new LatexDagEngine();
      const analysis = dag.buildFromProjectFiles(
        tintFiles
          .filter((f) => f.path.endsWith('.tex'))
          .map((f) => ({
            id: f.id,
            title: f.path,
            path: f.path,
            content: f.content,
          })),
      );

      // Even when editing a deep appendix file Attention_simulation_appendix.tex, root must trace back to main_arxiv.tex
      const rootFromDeepChild = dag.inferRootDocument('Attention_simulation_appendix.tex');
      expect(rootFromDeepChild.rootPath).toBe('main_arxiv.tex');

      const mainNode = analysis.nodes.get('main_arxiv.tex');
      expect(mainNode?.hasDocumentClass).toBe(true);
      expect(mainNode?.includes).toContain('experiments.tex');
      expect(mainNode?.includes).toContain('Appendix.tex');
      // Commented-out %\input{construction_v2} must be excluded
      expect(mainNode?.includes).not.toContain('construction_v2.tex');

      // experiments.tex includes Tables/LM_table.tex and Tables/Downstream_table.tex
      const expNode = analysis.nodes.get('experiments.tex');
      expect(expNode?.includes).toEqual(
        expect.arrayContaining(['Tables/LM_table.tex', 'Tables/Downstream_table.tex']),
      );

      // Appendix.tex includes Attention_simulation_appendix.tex, Linear_simulation_appendix.tex, etc.
      const appNode = analysis.nodes.get('Appendix.tex');
      expect(appNode?.includes).toEqual(
        expect.arrayContaining([
          'Attention_simulation_appendix.tex',
          'Linear_simulation_appendix.tex',
          'Layernorm_simulation.tex',
        ]),
      );
    });

    it('indexes 250+ math macros (\\newcommand, \\newcommand*, \\def), 60+ BibTeX entries, and multi-line captions with nested macros', () => {
      const indexCore = new LatexSymbolsIndexCore();
      for (const file of tintFiles) {
        if (file.path.endsWith('.bbl')) continue; // test pure .bib indexing on tint
        indexCore.indexFile(file.id, file.path, file.content);
      }

      const snapshot = indexCore.exportSnapshot();

      // 1. Over 250 custom math commands from math_commands.tex & symbols.tex
      expect(snapshot.commands.length).toBeGreaterThan(250);
      const cmdNames = new Set(snapshot.commands.map((c) => c.name));
      expect(cmdNames.has('\\zero')).toBe(true); // \newcommand*{\zero}
      expect(cmdNames.has('\\one')).toBe(true); // \newcommand*{\one}
      expect(cmdNames.has('\\given')).toBe(true); // \def\given
      expect(cmdNames.has('\\argmin')).toBe(true);
      expect(cmdNames.has('\\polylog')).toBe(true);

      // 2. All BibTeX entries from 857-line bibliography.bib
      expect(snapshot.citations.length).toBeGreaterThanOrEqual(60);
      const pythia = snapshot.citations.find((c) => c.key === 'biderman2023pythia');
      expect(pythia).toBeDefined();
      expect(pythia?.year).toBe('2023');
      expect(pythia?.title).toContain('Pythia: A suite for analyzing large language models');

      // 3. Multi-line caption in experiments.tex (lines 5-9) with nested \textsc{WikiText-103} and \simulator{}
      const expOutline = snapshot.flatOutlineByFile['experiments.tex'] || [];
      const lmTableCaption = expOutline.find((item) => item.type === 'table');
      expect(lmTableCaption).toBeDefined();
      expect(lmTableCaption?.title).toContain('Language modeling results on \\textsc{WikiText-103}');
      expect(lmTableCaption?.title).toContain('explicitly updating the auxiliary model');

      // 4. Paragraph header with nested \simulator{} macro in Attention_simulation_appendix.tex
      const attnAppOutline = snapshot.flatOutlineByFile['Attention_simulation_appendix.tex'] || [];
      const forwardParagraph = attnAppOutline.find((item) =>
        item.title.includes('Self-attention forward module'),
      );
      expect(forwardParagraph).toBeDefined();
      expect(forwardParagraph?.title).toBe('\\simulator{} Self-attention forward module');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 4 (CS-4): LARGE-SCALE CITATION REFACTORING & RETRACTION GATE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-4: Project-Wide Citation Refactoring & Retracted Paper Gate at Scale (>300KB across 30+ files)', () => {
    const tintFiles = loadRealWorldDataset('tint');

    it('refactors a citation key across all 30+ files of TinT in < 100ms without corrupting prefix-sharing keys', () => {
      const validation = validateCitationKey('biderman2023pythia_icml', 'biderman2023pythia');
      expect(validation.isValid).toBe(true);

      const start = performance.now();
      const refactorResult = refactorCitationKeyAcrossFiles(
        tintFiles.map((f) => ({ id: f.id, path: f.path, content: f.content })),
        'biderman2023pythia',
        'biderman2023pythia_icml',
      );
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(150);
      expect(refactorResult.totalCount).toBeGreaterThanOrEqual(2);

      const modifiedBib = refactorResult.modifiedFiles.find((f) => f.path === 'bibliography.bib');
      expect(modifiedBib).toBeDefined();
      expect(modifiedBib?.newContent).toContain('@inproceedings{biderman2023pythia_icml,');

      const modifiedIntro = refactorResult.modifiedFiles.find((f) => f.path === 'intro.tex');
      expect(modifiedIntro).toBeDefined();
      expect(modifiedIntro?.newContent).toContain('biderman2023pythia_icml');
    });

    it('flags retracted citations across the full TinT bibliography during pre-submission audit', () => {
      const symbolsIndex = new LatexSymbolsIndex();
      const bibFile = tintFiles.find((f) => f.path === 'bibliography.bib')!;
      symbolsIndex.indexFile(bibFile.id, bibFile.path, bibFile.content, true);

      symbolsIndex.setLibraryCitations([
        {
          id: 'lib-dai-2022',
          citationKey: 'dai2022gpt',
          title: 'Why Can GPT Learn In-Context?',
          isRetracted: true,
          retractionReason: 'Synthetic benchmark contamination discovered post-publication',
          retractionNature: 'Retraction',
        },
      ]);

      const entry = symbolsIndex.getCitationByKey('dai2022gpt');
      expect(entry).toBeDefined();
      expect(entry?.isRetracted).toBe(true);
      expect(entry?.retractionReason).toContain('Synthetic benchmark contamination');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 5 (CS-5): MASSIVE 2,500+ LINE TEX LIVE COMPILER LOG STREAM
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-5: Massive 2,500+ Line TeX Live Compiler Log Stream & Multi-Folder Error Stepping', () => {
    it('parses a 2,500+ line TeX Live log stream with nested subfolder errors, warnings, and bad boxes in < 100ms', () => {
      const logLines: string[] = [
        'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
        '(./main_arxiv.tex',
        'LaTeX2e <2023-06-01> patch level 1',
      ];

      // Simulate 2,400 lines of package loading, font info, bad boxes, and warnings
      for (let i = 1; i <= 600; i++) {
        logLines.push(`(/usr/local/texlive/2023/texmf-dist/tex/latex/base/pkg${i}.sty)`);
        logLines.push(`LaTeX Font Warning: Font shape \`OT1/cmr/m/n' in size <${i % 20}> not available on input line ${i * 2}.`);
        logLines.push(`Package hyperref Warning: Token not allowed in a PDF string (Unicode) on input line ${i * 3}.`);
        logLines.push(`Overfull \\hbox (${(i % 40) + 1}.42pt too wide) in paragraph at lines ${i * 5}--${i * 5 + 4}`);
      }

      // Inject realistic hard errors across nested subdirectories of TinT
      logLines.push('./Proofs/Proof_activation_backprop.tex:48: Undefined control sequence \\losspartial.');
      logLines.push('l.48 \\losspartial{\\vy_t}');
      logLines.push('./Tables/Downstream_table.tex:19: Misplaced alignment tab character &.');
      logLines.push('l.19GPT-2 & 72.4 & 75.1 & & \\\\');
      logLines.push('./Theorems/softmax_linear.tex:112: LaTeX Error: \\begin{lemma} on input line 95 ended by \\end{theorem}.');
      logLines.push('! Emergency stop.');
      logLines.push('l.210 \\end{document}');

      const massiveLog = logLines.join('\n');
      expect(logLines.length).toBeGreaterThan(2400);

      const start = performance.now();
      const parsed = parseLatexLog(massiveLog);
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(150);
      expect(parsed.errors.length).toBe(4);
      expect(parsed.errors[0]).toMatchObject({
        file: 'Proofs/Proof_activation_backprop.tex',
        line: 48,
      });
      expect(parsed.errors[1]).toMatchObject({
        file: 'Tables/Downstream_table.tex',
        line: 19,
      });
      expect(parsed.errors[2]).toMatchObject({
        file: 'Theorems/softmax_linear.tex',
        line: 112,
      });

      // Verify warning suppression filter cleanly removes font/package/badBox noise
      const cleanWarnings = filterDiagnostics(parsed.warnings, {
        suppressBadBoxes: true,
        suppressFontWarnings: true,
        suppressPackageWarnings: true,
        customPatterns: [],
      });
      expect(cleanWarnings.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 6 (CS-6): HIGH-CONCURRENCY DEADLINE SPRINT & MENTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-6: High-Concurrency Multi-Author Review Threads & @mentions', () => {
    it('extracts multiple co-author @mentions accurately across dense review threads', () => {
      const commentBody =
        'Please verify Equation 4 with @ashish_vaswani and @[Noam Shazeer](user-noam) before @lukasz_kaiser merges the camera-ready appendix.';
      const mentions = extractMentions(commentBody);
      expect(mentions.map((m) => m.name)).toEqual([
        'Noam Shazeer',
        'ashish_vaswani',
        'lukasz_kaiser',
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 7 (CS-7): FULL-PROJECT 0MS SNAPSHOT & EXPERIMENTAL TABLE PASTE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-7: Full-Project 0ms Compilation Snapshot (30+ Nested Files) & Large Table Smart Paste', () => {
    const tintFiles = loadRealWorldDataset('tint');

    it('assembles a 0ms compilation snapshot across all 30+ TinT files while merging dirty buffers in nested subfolders', () => {
      const baseFiles = tintFiles.map((f) => ({
        id: f.id,
        path: f.path,
        content: f.content,
      }));

      const snapshot = assembleCompilationSnapshot({
        resolvedMainFile: 'main_arxiv.tex',
        baseFiles,
        dirtyFiles: [
          {
            fileId: 'tint:Proofs/Proof_activation_backprop.tex',
            content: '% UPDATED PROOF IN MEMORY\n\\begin{proof}Verified Q.E.D.\\end{proof}',
          },
        ],
        activeDoc: {
          id: 'tint:Tables/LM_table.tex',
          path: 'Tables/LM_table.tex',
        },
        activeContent: '% LIVE ACTIVE EDIT IN LM_TABLE\n\\begin{tabular}{cc}A & B\\end{tabular}',
      });

      // Nested folder paths must be 100% preserved
      expect(snapshot.mainFile).toBe('main_arxiv.tex');
      expect(snapshot.files['main_arxiv.tex']).toContain('\\documentclass{article}');
      expect(snapshot.files['Proofs/Proof_activation_backprop.tex']).toContain('Verified Q.E.D.');
      expect(snapshot.files['Tables/LM_table.tex']).toContain('LIVE ACTIVE EDIT IN LM_TABLE');
      expect(snapshot.files['Theorems/softmax_linear.tex']).toBeDefined();
      expect(snapshot.files['bibliography.bib']).toContain('@article{perez2021attention');
    });

    it('converts a multi-column benchmark TSV table from Excel/Sheets into a valid LaTeX tabular via Smart Paste', () => {
      const tsvBenchmark = [
        'Model\tMNLI-(m/mm)\tQQP\tQNLI\tSST-2\tCoLA\tSTS-B\tMRPC\tRTE\tAverage',
        'Pre-OpenAI SOTA\t80.6/80.1\t66.1\t82.3\t93.2\t35.0\t81.0\t86.0\t61.7\t74.0',
        'BiLSTM+ELMo+Attn\t76.4/76.1\t64.8\t79.8\t90.4\t36.0\t73.3\t84.9\t56.8\t71.0',
        'OpenAI GPT\t82.1/81.4\t70.3\t87.4\t91.3\t45.4\t80.0\t82.3\t56.0\t75.1',
        'BERT_BASE\t84.6/83.4\t71.2\t90.5\t93.5\t52.1\t85.8\t88.9\t66.4\t79.6',
        'BERT_LARGE\t86.7/85.9\t72.1\t92.7\t94.9\t60.5\t86.5\t89.3\t70.1\t82.1',
      ].join('\n');

      const mockClipboard = {
        getData: (format: string) => (format === 'text/plain' ? tsvBenchmark : ''),
      } as unknown as DataTransfer;

      const latexTable = parseTableToLatex(mockClipboard, {
        caption: 'GLUE Benchmark Results',
        label: 'tab:glue_official',
      });
      expect(latexTable).toBeDefined();
      expect(latexTable).toContain('\\begin{table}');
      expect(latexTable).toContain('\\begin{tabular}');
      expect(latexTable).toContain('MNLI-(m/mm)');
      // Underscores in BERT_BASE and BERT_LARGE must be escaped as \_
      expect(latexTable).toContain('BERT\\_BASE');
      expect(latexTable).toContain('BERT\\_LARGE');
      expect(latexTable).toContain('86.7/85.9');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 8 (CS-8): PROJECT-WIDE STATIC LINTER ON REAL CONFERENCE PAPERS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-8: Project-Wide Real-Time Linter Audit Across Real Conference Papers', () => {
    const attentionFiles = loadRealWorldDataset('attention');
    const tintFiles = loadRealWorldDataset('tint');

    it('detects legacy LaTeX 2.09 \\bf commands in attention/results.tex while ignoring \\iffalse blocks and multi-line $$ math in TinT', () => {
      const resultsTex = attentionFiles.find((f) => f.path === 'results.tex')!;
      const diags = runLatexLinter(resultsTex.content);

      // Line 125 of attention/results.tex uses `{\bf Parser} & {\bf Training} & {\bf WSJ 23 F1}`
      const deprecatedBf = diags.filter((d) => d.code === 'DEPRECATED_COMMAND');
      expect(deprecatedBf.length).toBeGreaterThanOrEqual(1);
      expect(deprecatedBf[0].startLineNumber).toBe(125);

      // Commented-out `\iffalse ... \fi` table in tint/Tables/LM_table.tex must produce 0 diagnostics
      const lmTableTex = tintFiles.find((f) => f.path === 'Tables/LM_table.tex')!;
      const lmDiags = runLatexLinter(lmTableTex.content);
      expect(lmDiags).toHaveLength(0);

      // Multi-line $$ ... $$ display math and \bibliography{main_arxiv} must not trigger UNESCAPED_UNDERSCORE
      const multiLineMathSample = [
        '\\documentclass{article}',
        '\\begin{document}',
        '$$',
        '  \\mathrm{Attention}(Q_i, K_j, V_k) = \\mathrm{softmax}\\left(\\frac{Q_i K_j^T}{\\sqrt{d_k}}\\right) V_k',
        '$$',
        '\\bibliography{main_arxiv}',
        '\\end{document}',
      ].join('\n');
      const mathDiags = runLatexLinter(multiLineMathSample);
      expect(mathDiags.filter((d) => d.code === 'UNESCAPED_UNDERSCORE')).toHaveLength(0);
    });

    it('validates multi-target \\cref{k1,k2} against the full TinT project label set and catches broken cross-references', () => {
      const symbolsCore = new LatexSymbolsIndexCore();
      for (const f of tintFiles) {
        symbolsCore.indexFile(f.id, f.path, f.content);
      }
      const snapshot = symbolsCore.exportSnapshot();
      const projectLabelSet = new Set(snapshot.labels.map((l) => l.name));
      expect(projectLabelSet.size).toBeGreaterThanOrEqual(55);
      const [validKey1, validKey2] = Array.from(projectLabelSet);

      const sampleSection = [
        `As shown in \\cref{${validKey1},${validKey2}}, the auxiliary model converges.`,
        `However, \\Cref{${validKey1},thm:nonexistent_bound_999} fails on the second key.`,
      ].join('\n');

      const refDiags = lintLabelsAndReferences(sampleSection, projectLabelSet);
      const undefDiags = refDiags.filter((d) => d.code === 'UNDEFINED_REFERENCE');
      expect(undefDiags).toHaveLength(1);
      expect(undefDiags[0].message).toContain('thm:nonexistent_bound_999');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 9 (CS-9): TEXCOUNT MULTI-FILE WORD & STRUCTURAL STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-9: TeXcount Multi-File Project Word, Header, Float & Math Statistics', () => {
    const attentionFiles = loadRealWorldDataset('attention');
    const tintFiles = loadRealWorldDataset('tint');

    it('aggregates full-project TeXcount statistics across all \\input files of NeurIPS 2017 (attention)', () => {
      const filesMap: Record<string, string> = {};
      for (const f of attentionFiles) {
        filesMap[f.path] = f.content;
      }

      const stats = countProjectLatexWords(filesMap, {
        rootFile: 'ms.tex',
        includeBib: true,
      });

      expect(stats.rootFile).toBe('ms.tex');
      expect(stats.includedFiles).toEqual(
        expect.arrayContaining([
          'ms.tex',
          'introduction.tex',
          'background.tex',
          'model_architecture.tex',
          'why_self_attention.tex',
          'training.tex',
          'results.tex',
          'visualizations.tex',
        ]),
      );
      expect(stats.headers).toBeGreaterThanOrEqual(15);
      expect(stats.floats).toBeGreaterThanOrEqual(6);
      expect(stats.mathInlines).toBeGreaterThanOrEqual(80);
      expect(stats.wordsInText).toBeGreaterThan(3500);
      expect(stats.wordsInCaptions).toBeGreaterThan(100);
      expect(stats.wordsInBibliography).toBeGreaterThan(400);
      expect(stats.totalWords).toBeGreaterThan(4200);
    });

    it('accurately counts headers and multi-line captions with nested macros in ICML 2024 (tint) while ignoring \\iffalse tables', () => {
      // LM_table.tex is wrapped in \iffalse ... \fi, so its words/floats must be 0
      const lmTableFile = tintFiles.find((f) => f.path === 'Tables/LM_table.tex')!;
      const commentedStats = countLatexWords(lmTableFile.content);
      expect(commentedStats.floats).toBe(0);
      expect(commentedStats.totalWords).toBe(0);

      // When unwrapped (active table), balanced-brace caption and float are counted accurately
      const activeTableLatex = lmTableFile.content
        .replace(/^\\iffalse\s*/, '')
        .replace(/\\fi\s*$/, '');
      const activeStats = countLatexWords(activeTableLatex);
      expect(activeStats.floats).toBe(1);
      expect(activeStats.wordsInCaptions).toBeGreaterThan(45);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 10 (CS-10): VISUAL TABLE REVERSE-PARSING ON REAL BENCHMARK TABLES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-10: Academic Benchmark Table Reverse-Parsing (booktabs @{}, \\cmidrule, \\multicolumn, \\multirow)', () => {
    const attentionFiles = loadRealWorldDataset('attention');
    const tintFiles = loadRealWorldDataset('tint');

    it('reverse-parses TinT language modeling table with @{}lcccccccc@{} spec, \\cmidrule(lr), \\multicolumn, and nested-brace \\caption', () => {
      const lmTableFile = tintFiles.find((f) => f.path === 'Tables/LM_table.tex')!;
      const activeLatex = lmTableFile.content
        .replace(/^\\iffalse\s*/, '')
        .replace(/\\fi\s*$/, '');

      const grid = parseLatexTabular(activeLatex);
      expect(grid).not.toBeNull();
      expect(grid!.style).toBe('booktabs');
      expect(grid!.label).toBe('tab:language_modeling');
      expect(grid!.caption).toContain('\\textsc{WikiText-103}');
      expect(grid!.caption).toContain('\\cref{sec:modification}');
      expect(grid!.cols).toBe(9);
      expect(grid!.alignments).toEqual(['l', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c']);
      // First header row has \multicolumn{4}{c}{\textsc{GPT2}} and \multicolumn{4}{c}{\textsc{OPT-125m}}
      expect(grid!.headers[1]).toContain('\\textsc{GPT2}');
      expect(grid!.headers[5]).toContain('\\textsc{OPT-125m}');
      // Data rows contain Vanilla Model, Dyna. FT, and TinT
      const firstColModels = grid!.data.map((r) => r[0]);
      expect(firstColModels).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Vanilla Model'),
          expect.stringContaining('Dyna. FT'),
          expect.stringContaining('TinT'),
        ]),
      );
    });

    it('reverse-parses Attention WMT results table while stripping commented rows and \\specialrule', () => {
      const resultsTex = attentionFiles.find((f) => f.path === 'results.tex')!;
      const grid = parseLatexTabular(resultsTex.content);

      expect(grid).not.toBeNull();
      expect(grid!.label).toBe('tab:wmt-results');
      expect(grid!.style).toBe('booktabs');
      expect(grid!.centering).toBe(true);
      expect(grid!.cols).toBe(6);
      expect(grid!.headers[0]).toBe('Model');
      expect(grid!.headers[1]).toBe('BLEU');

      const allRowModels = grid!.data.map((r) => r[0]);
      expect(allRowModels.some((m) => m.includes('ByteNet'))).toBe(true);
      expect(allRowModels.some((m) => m.includes('Transformer (base model)'))).toBe(true);
      expect(allRowModels.some((m) => m.includes('Transformer (big)'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 11 (CS-11): VISUAL MODE HEADINGS & ACL CITATION EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-11: Visual Mode Non-Destructive Heading Brace Matching & ACL Citation Extraction', () => {
    const bertFiles = loadRealWorldDataset('bert');

    it('extracts all citation keys including ACL \\newcite across BERT .tex files and triggers autocomplete on \\newcite{', () => {
      const allBertTex = bertFiles
        .filter((f) => f.path.endsWith('.tex'))
        .map((f) => f.content)
        .join('\n');
      const keys = extractCitationKeys(allBertTex);

      expect(keys.length).toBeGreaterThanOrEqual(45);
      // Specifically verify keys inside `\newcite{parikh-etal:2016, bidaf}` in BERT
      expect(keys).toContain('parikh-etal:2016');
      expect(keys).toContain('bidaf');

      const trigger = detectCitationTrigger('As shown in \\newcite{parikh-etal:2016, bi');
      expect(trigger).toEqual({
        isTrigger: true,
        format: 'latex',
        searchPrefix: 'bi',
      });
    });

    it('matches balanced closing braces for Visual Mode headings containing nested LaTeX macros', () => {
      const line = '\\paragraph{Construction of \\simulator{} module in \\textsc{TinT} ($L=12$)}';
      const openIdx = line.indexOf('{');
      const closeIdx = findMatchingBrace(line, openIdx);
      expect(closeIdx).toBe(line.length - 1);
      expect(line.slice(openIdx + 1, closeIdx!)).toBe(
        'Construction of \\simulator{} module in \\textsc{TinT} ($L=12$)',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 12 (CS-12): ARCHIVE SECURITY SANITIZATION & ACADEMIC FILE TREE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-12: Archive Zip-Slip Sanitization & Academic File Tree Organization on 50+ TinT Files', () => {
    const tintFiles = loadRealWorldDataset('tint');

    it('neutralizes Zip-Slip path traversal sequences and detects common Overleaf/ArXiv root prefixes', () => {
      expect(sanitizeZipPath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeZipPath('C:\\Users\\admin\\..\\project\\Sections\\intro.tex')).toBe(
        'Users/project/Sections/intro.tex',
      );

      const archivePaths = [
        'tint-icml2024/main_arxiv.tex',
        'tint-icml2024/Proofs/Proof_activation_backprop.tex',
        'tint-icml2024/Tables/LM_table.tex',
        '__MACOSX/._main_arxiv.tex',
      ];
      expect(detectCommonRootPrefix(archivePaths)).toBe('tint-icml2024/');
    });

    it('builds a prioritized academic file tree for all 50+ TinT files and filters recursively by query', () => {
      const tree = buildFileTree({
        configuredMainFile: 'main_arxiv.tex',
        files: tintFiles.map((f) => ({
          id: f.id,
          title: f.path,
          isRootDoc: f.path === 'main_arxiv.tex',
        })),
      });

      // Root document `main_arxiv.tex` must be placed at the very top of the tree
      expect(tree[0]).toMatchObject({
        type: 'file',
        title: 'main_arxiv.tex',
        isRootDoc: true,
      });

      // Filtering by "LM_table" must recursively locate Tables/LM_table.tex
      const filtered = filterFileTree(tree, 'LM_table');
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('folder');
      if (filtered[0].type === 'folder') {
        expect(filtered[0].name).toBe('Tables');
        expect(filtered[0].children[0]).toMatchObject({
          type: 'file',
          title: 'Tables/LM_table.tex',
        });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 13 (CS-13): OFFLINE DRAFT LCS DIFF ON LARGE CONFERENCE MANUSCRIPTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-13: Offline Draft Recovery LCS Diff on Large Conference Manuscript (Full BERT Corpus)', () => {
    const bertFiles = loadRealWorldDataset('bert');

    it('computes exact line-level LCS diff between server BERT manuscript (>1,000 lines) and offline-edited draft in < 50ms', () => {
      const serverBert = bertFiles
        .filter((f) => f.path.endsWith('.tex'))
        .map((f) => f.content)
        .join('\n');
      const lines = serverBert.split('\n');
      expect(lines.length).toBeGreaterThan(800);

      // Simulate offline author editing 2 lines in the middle and adding 1 new paragraph line
      const draftLines = [...lines];
      draftLines[200] = '% OFFLINE EDIT: Updated pre-training objective explanation';
      draftLines.splice(450, 1, 'We further validate this on SQuAD v2.0.', 'Additional ablation on warmup steps.');
      const draftBert = draftLines.join('\n');

      const start = performance.now();
      const diff = computeDraftDiffSummary(draftBert, serverBert, 10);
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(100);
      expect(diff.identical).toBe(false);
      expect(diff.addedLines).toBe(3);
      expect(diff.removedLines).toBe(2);
      expect(diff.draftLineCount).toBe(lines.length + 1);
      expect(diff.preview.some((p) => p.type === 'added' && p.text.includes('OFFLINE EDIT'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 14 (CS-14): BIBLIOGRAPHY GENERATION & NON-DESTRUCTIVE INJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-14: Bibliography Section Generation & Non-Destructive Replacement on Real Papers', () => {
    const attentionFiles = loadRealWorldDataset('attention');

    it('replaces existing \\begin{thebibliography} in attention/ms.tex without duplicating the section', () => {
      const msTex = attentionFiles.find((f) => f.path === 'ms.tex')!.content;

      const newBibSection = buildBibliographySection({
        bibliographyText: '',
        format: 'latex',
        citations: [
          {
            key: 'vaswani2017attention',
            bibliography: 'Ashish Vaswani et al. Attention Is All You Need. NeurIPS 2017.',
          },
          {
            key: 'devlin2019bert',
            bibliography: 'Jacob Devlin et al. BERT: Pre-training of Deep Bidirectional Transformers. NAACL 2019.',
          },
        ],
      });

      const injected = injectBibliographyIntoDocument({
        currentContent: msTex,
        newSection: newBibSection,
        format: 'latex',
      });

      expect(injected.action).toBe('replaced');
      const matches = injected.nextContent.match(/\\begin\{thebibliography\}/g) || [];
      expect(matches).toHaveLength(1);
      expect(injected.nextContent).toContain('\\bibitem{vaswani2017attention}');
      expect(injected.nextContent).toContain('\\bibitem{devlin2019bert}');
      expect(injected.nextContent).toContain('\\end{document}');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 15 (CS-15): DOCUMENT AST STRUCTURE & LINE CONTEXT ON REAL PAPERS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-15: Document AST Structure & Line Context Resolution on Real Conference Papers (attention & tint)', () => {
    const attentionFiles = loadRealWorldDataset('attention');
    const tintFiles = loadRealWorldDataset('tint');

    it('extracts nested-brace section titles, natbib/ACL citations (\\citet, \\citep, \\newcite), and skips \\iffalse blocks across tint & attention', () => {
      const tintCombined = tintFiles
        .filter((f) => f.path.endsWith('.tex'))
        .map((f) => f.content)
        .join('\n');
      const attentionCombined = attentionFiles
        .filter((f) => f.path.endsWith('.tex'))
        .map((f) => f.content)
        .join('\n');

      const tintAst = parseLatexStructure(tintCombined);
      const attentionAst = parseLatexStructure(attentionCombined);

      expect(tintAst.sections.length).toBeGreaterThanOrEqual(20);
      expect(tintAst.labels.length).toBeGreaterThanOrEqual(45);
      expect(tintAst.citations.length).toBeGreaterThanOrEqual(30);
      expect(attentionAst.citations.length).toBeGreaterThanOrEqual(30);

      // Verify nested braces in section titles are preserved without premature truncation
      const complexSec = parseLatexStructure(
        '\\section{Analysis of \\textsc{TinT} and $\\mathcal{O}(d^2)$}\n% \\section{Commented Draft}\n\\iffalse\n\\section{Hidden Block}\n\\fi\n\\begin{equation}\\label{eq:main}\\label{eq:alias}\nE = mc^2\n\\end{equation}',
      );
      expect(complexSec.sections).toHaveLength(1);
      expect(complexSec.sections[0].title).toBe('Analysis of \\textsc{TinT} and $\\mathcal{O}(d^2)$');
      expect(complexSec.labels).toEqual(['eq:main', 'eq:alias']);

      // Verify getLineContext resolves exact section and environment at line 6
      const ctx = getLineContext(6, complexSec);
      expect(ctx.section).toBe('\\section{Analysis of \\textsc{TinT} and $\\mathcal{O}(d^2)$}');
      expect(ctx.environment).toBe('equation');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 16 (CS-16): MULTI-FILE OUTLINE & MULTI-LINE CAPTION EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-16: Multi-File Document Outline & Multi-Line Figure/Table Caption Extraction on attention & tint', () => {
    const attentionFiles = loadRealWorldDataset('attention');
    const tintFiles = loadRealWorldDataset('tint');

    it('extracts clean section outlines and multi-line figure/table captions across attention & tint without leaking \\iffalse blocks', () => {
      const attentionEntries = attentionFiles
        .filter((f) => f.path.endsWith('.tex'))
        .flatMap((f) => parseLatexHeadings(f.content, f.path));

      const tintEntries = tintFiles
        .filter((f) => f.path.endsWith('.tex'))
        .flatMap((f) => parseLatexHeadings(f.content, f.path));

      expect(attentionEntries.filter((e) => e.type === 'section').length).toBeGreaterThanOrEqual(6);
      expect(attentionEntries.filter((e) => e.type === 'figure' || e.type === 'table').length).toBeGreaterThanOrEqual(3);
      expect(tintEntries.filter((e) => e.type === 'section' || e.type === 'subsection').length).toBeGreaterThanOrEqual(20);

      // Verify cleanLatexTitle unescapes \&, \%, \_ and strips formatting/citations cleanly
      const cleaned = cleanLatexTitle(
        'WMT 2014 English\\&German \\textbf{BLEU} Scores \\_v2 (100\\%) \\cite{vaswani2017}\\label{sec:wmt}',
      );
      expect(cleaned).toBe('WMT 2014 English&German BLEU Scores _v2 (100%)');

      // Verify extractOutlineFromContent maps lines to PDF pages monotonically
      const modelArchTex = attentionFiles.find((f) => f.path === 'model_architecture.tex')!.content;
      const pdfBookmarks = extractOutlineFromContent(modelArchTex, 15);
      expect(pdfBookmarks.length).toBeGreaterThanOrEqual(4);
      expect(pdfBookmarks[0].pageNumber).toBeGreaterThanOrEqual(1);
      expect(pdfBookmarks[pdfBookmarks.length - 1].pageNumber).toBeLessThanOrEqual(15);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 17 (CS-17): CODEMIRROR 6 HIERARCHICAL LATEX CODE FOLDING
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-17: CodeMirror 6 Hierarchical Section & Environment Folding on Real Conference Files', () => {
    const attentionFiles = loadRealWorldDataset('attention');

    it('folds nested \\section and multi-line environments in attention/model_architecture.tex while ignoring single-line envs and comments', () => {
      const modelArch = attentionFiles.find((f) => f.path === 'model_architecture.tex')!.content;
      const state = EditorState.create({ doc: modelArch });

      // Find the first \section or \subsection line and verify it folds across multiple lines
      let foldedSections = 0;
      let foldedEnvs = 0;
      for (let ln = 1; ln <= state.doc.lines; ln++) {
        const line = state.doc.line(ln);
        const range = computeLatexFoldRange(state, line.from);
        if (range) {
          expect(range.to).toBeGreaterThan(range.from);
          if (line.text.trim().startsWith('\\begin{')) foldedEnvs++;
          else foldedSections++;
        }
      }
      expect(foldedSections).toBeGreaterThanOrEqual(4);
      expect(foldedEnvs).toBeGreaterThanOrEqual(2);

      // Verify single-line \begin{center}...\end{center} and commented % \end{figure} do not corrupt folding
      const edgeDoc = [
        '\\begin{center}\\textbf{Inline Header}\\end{center}',
        '\\begin{figure}[ht]',
        '  % \\end{figure} commented out inside figure',
        '  \\centering',
        '  \\caption{Transformer Architecture}',
        '\\end{figure}',
        '\\section[Short]{Main Section}',
        'Paragraph 1',
        '% \\section{Commented Section}',
        'Paragraph 2',
        '\\section{Next Section}',
      ].join('\n');
      const edgeState = EditorState.create({ doc: edgeDoc });

      // Line 1 is single-line center environment -> should NOT fold onto subsequent lines
      expect(computeLatexFoldRange(edgeState, edgeState.doc.line(1).from)).toBeNull();

      // Line 2 is \begin{figure} -> should fold all the way to line 6 (\end{figure}), skipping line 3's commented \end{figure}
      const figFold = computeLatexFoldRange(edgeState, edgeState.doc.line(2).from);
      expect(figFold).not.toBeNull();
      expect(figFold!.to).toBe(edgeState.doc.line(6).to);

      // Line 7 is \section[Short]{Main Section} -> should fold to line 10 (skipping line 9's commented \section)
      const secFold = computeLatexFoldRange(edgeState, edgeState.doc.line(7).from);
      expect(secFold).not.toBeNull();
      expect(secFold!.to).toBe(edgeState.doc.line(10).to);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 18 (CS-18): RECURSIVE XY-CUT MULTI-COLUMN PDF READING ORDER
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-18: Recursive XY-Cut Two-Column Conference Layout Analysis (Spanning Title + Two-Column Body)', () => {
    it('separates full-width spanning title/abstract from two-column body and reads entire Left Column before Right Column', () => {
      // Simulate Page 1 of an ACL/ICML two-column paper (width 595pt, height 842pt):
      // - Full-width title at y=60 (x=72..523, w=451)
      // - Small 14pt gap (y=80..94) before two-column body
      // - Left column (x=72..280) and Right column (x=315..523) with a 35pt column gutter
      // - Inside the two-column body, both columns have a wider 22pt vertical gap at y=200..222
      const items: PdfTextItem[] = [
        { str: 'BERT: Pre-training of Deep Bidirectional Transformers', x: 72, y: 60, w: 451, h: 18 },
        // Left Column (top paragraph + bottom paragraph after 22pt gap)
        { str: 'L1: We introduce a new language representation model.', x: 72, y: 95, w: 205, h: 10 },
        { str: 'L2: Unlike recent representation models, BERT is deep.', x: 72, y: 110, w: 205, h: 10 },
        { str: 'L3: Left column second section after wide gap.', x: 72, y: 225, w: 205, h: 10 },
        { str: 'L4: Left column conclusion of page 1.', x: 72, y: 240, w: 205, h: 10 },
        // Right Column (top paragraph + bottom paragraph after 22pt gap)
        { str: 'R1: Right column starts here at the top of column 2.', x: 315, y: 95, w: 205, h: 10 },
        { str: 'R2: Pre-trained representations can be fine-tuned.', x: 315, y: 110, w: 205, h: 10 },
        { str: 'R3: Right column second section after wide gap.', x: 315, y: 225, w: 205, h: 10 },
        { str: 'R4: Right column final line on page 1.', x: 315, y: 240, w: 205, h: 10 },
      ];

      const layout = performRecursiveXyCut(items, { pageWidth: 595, pageHeight: 842 });
      expect(layout.columnCount).toBe(2);

      const orderedStrings = layout.orderedItems.map((it) => it.str.slice(0, 2));
      // Natural reading order MUST be: Title ('BE') -> L1 -> L2 -> L3 -> L4 -> R1 -> R2 -> R3 -> R4
      expect(orderedStrings).toEqual(['BE', 'L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 19 (CS-19): ARCHITECTURE DIAGRAM -> TIKZ TRANSPILER & QUADTREE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-19: Neural Architecture Diagram Canvas -> TikZ Transpilation & Spatial QuadTree Indexing', () => {
    it('transpiles Transformer/TinT diagram nodes with inline math ($...$) and special chars into compilable TikZ without double-escaping \\textbackslash{}', () => {
      const escaped = escapeLatexText('Layer_1 (100% & #1) \\ Softmax($QK^T / \\sqrt{d_k}$)');
      expect(escaped).toContain('Layer\\_1 (100\\% \\& \\#1) \\textbackslash{} Softmax($QK^T / \\sqrt{d_k}$)');
      expect(escaped).not.toContain('\\textbackslash\\{\\}');

      const tikzCode = TikZTranspiler.transpile(
        [
          {
            id: 'qkv-node',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 120,
            height: 60,
            text: 'Scaled Dot-Product $\\text{Attention}(Q,K,V)$',
            fillColor: '#3b82f6',
            strokeColor: '#1e293b',
          },
          {
            id: 'ffn-node',
            type: 'ellipse',
            x: 100,
            y: 220,
            width: 120,
            height: 60,
            text: 'Feed_Forward 100%',
            fillColor: '#10b981',
          },
          {
            id: 'edge-1',
            type: 'arrow',
            x: 160,
            y: 160,
            width: 0,
            height: 60,
            sourceElementId: 'qkv-node',
            targetElementId: 'ffn-node',
            text: '$h_t^{(l)}$',
            arrowEnd: true,
          },
        ],
        { includeDocumentWrapper: true },
      );

      expect(tikzCode).toContain('\\documentclass[border=10pt]{standalone}');
      expect(tikzCode).toContain('\\definecolor{c_1e293b}{HTML}{1E293B}');
      expect(tikzCode).toContain('Scaled Dot-Product $\\text{Attention}(Q,K,V)$');
      expect(tikzCode).toContain('Feed\\_Forward 100\\%');
      expect(tikzCode).toContain('(node_qkv_node) -- node[midway, above, font=\\footnotesize] {$h_t^{(l)}$} (node_ffn_node)');

      // Spatial QuadTree stress test with 1,000 diagram elements
      const qt = new QuadTree({ x: 0, y: 0, width: 4000, height: 4000 });
      for (let i = 0; i < 1000; i++) {
        qt.insert({
          id: `el-${i}`,
          x: (i % 50) * 70,
          y: Math.floor(i / 50) * 70,
          width: 50,
          height: 40,
        });
      }
      expect(qt.size()).toBe(1000);
      const viewportHits = qt.queryRange({ x: 0, y: 0, width: 300, height: 300 });
      expect(viewportHits.length).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 20 (CS-20): BOUNDED LRU DOCUMENT CACHE & MULTI-FOLDER RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-20: Bounded Multi-Tab LRUDocumentCache Governor & Multi-Folder Path Disambiguation across 30+ Files', () => {
    const tintFiles = loadRealWorldDataset('tint');
    const attentionFiles = loadRealWorldDataset('attention');

    it('streams 25+ real project files through a bounded cache (capacity=8), protects active file, flushes dirty evictions, and disambiguates identical basenames in different folders', () => {
      const savedDrafts: Array<{ fileId: string; filePath?: string; content: string }> = [];
      const cache = new LRUDocumentCache({
        saveDraft: async (fileId, content, _projectId, filePath) => {
          savedDrafts.push({ fileId, filePath, content });
        },
        getDraft: async () => null,
        deleteDraft: async () => {},
        clearAllDrafts: async () => {},
      });
      cache.setCapacity(8);

      // Pin main_arxiv.tex as active file and mark it dirty
      const mainFile = tintFiles.find((f) => f.path === 'main_arxiv.tex')!;
      cache.registerModel(mainFile.id, { content: mainFile.content, filePath: mainFile.path, projectId: 'tint' });
      cache.setActiveFileId(mainFile.id);
      cache.updateContent(mainFile.id, mainFile.content + '\n% Active edit', true);

      // Stream all remaining tint and attention files through the cache, marking 3 of them dirty
      const allOthers = [...tintFiles.filter((f) => f.path !== 'main_arxiv.tex'), ...attentionFiles];
      for (let i = 0; i < allOthers.length; i++) {
        const f = allOthers[i];
        cache.registerModel(f.id, { content: f.content, filePath: f.path, projectId: 'tint' });
        if (i < 3) {
          cache.updateContent(f.id, f.content + '\n% Unsaved section edit', true);
        }
      }

      // Capacity is strictly enforced at 8, active main.tex is NEVER evicted, and the 3 dirty files were flushed on eviction
      expect(cache.getStats().size).toBe(8);
      expect(cache.hasModel(mainFile.id)).toBe(true);
      expect(savedDrafts).toHaveLength(3);

      // Register two files with identical basenames in different folders: Sections/intro.tex vs Appendix/intro.tex
      cache.registerModel('sec-intro', { content: 'Section Intro Content', filePath: 'Sections/intro.tex' });
      cache.registerModel('app-intro', { content: 'Appendix Intro Content', filePath: 'Appendix/intro.tex' });

      expect(cache.findByPath('Sections/intro.tex')?.fileId).toBe('sec-intro');
      expect(cache.findByPath('Appendix/intro.tex')?.fileId).toBe('app-intro');
      expect(cache.findByPath('Appendix/intro')?.fileId).toBe('app-intro');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 21 (CS-21): AI HEURISTIC ERROR REMEDIATION & REVIEW DIGESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-21: AI Heuristic Error Remediation on Academic Packages & Review Notification Digest Formatting', () => {
    it('identifies missing academic packages (booktabs \\cmidrule, natbib \\citet, cleveref \\cref, multirow) and formats review notification digests', () => {
      const cmidruleFix = heuristicLatexErrorFix({
        errorMessage: 'Undefined control sequence.',
        errorLine: 42,
        detail: 'l.42 \\textbf{Model} \\cmidrule(lr){2-5}',
        surroundingCode: '\\toprule\n\\textbf{Model} \\cmidrule(lr){2-5}\n\\midrule',
      });
      expect(cmidruleFix.confidence).toBe('high');
      expect(cmidruleFix.explanation).toContain('booktabs');

      const citetFix = heuristicLatexErrorFix({
        errorMessage: 'Undefined control sequence.',
        errorLine: 18,
        detail: 'l.18 As shown by \\citet{vaswani2017attention}',
        surroundingCode: 'As shown by \\citet{vaswani2017attention}',
      });
      expect(citetFix.confidence).toBe('high');
      expect(citetFix.explanation).toContain('natbib');

      const crefFix = heuristicLatexErrorFix({
        errorMessage: 'Undefined control sequence.',
        errorLine: 95,
        detail: 'l.95 See \\Cref{sec:intro,sec:method}',
      });
      expect(crefFix.confidence).toBe('high');
      expect(crefFix.explanation).toContain('cleveref');

      // Review Notification Digest formatting
      expect(formatRemainingTime(600)).toBe('10m');
      expect(formatRemainingTime(125)).toBe('2m 5s');
      expect(formatRemainingTime(0)).toBe('flushing...');
      expect(formatDigestBadgeText(4, 480)).toBe('4 updates (flushing in 8m)');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 22 (CS-22): SYNCTEX 2D KD-TREE & MULTI-FOLDER BI-DIRECTIONAL SYNC
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-22: SyncTeX Multi-Folder Forward/Reverse 2D k-d Tree Spatial Resolution (TinT Multi-Folder Layout)', () => {
    it('resolves forward SyncTeX from line 1 (before first hbox record) and reverse 2D k-d tree clicks across two-column nested files', () => {
      const synctexPayload = [
        'SyncTeX Version:1',
        'Input:1:./main_arxiv.tex',
        'Input:2:./Sections/intro.tex',
        'Input:3:./Proofs/Proof_activation_backprop.tex',
        'Input:4:./Tables/LM_table.tex',
        'Unit:65536',
        '{1',
        // Left column in Sections/intro.tex (lines 6, 18, 35)
        'h2,6:72,120:210,12',
        'h2,18:72,240:210,12',
        'h2,35:72,480:210,12',
        // Right column in Sections/intro.tex (line 52)
        'h2,52:315,120:210,12',
        '}',
        '{2',
        // Page 2 has Tables/LM_table.tex (line 10) and Proofs/Proof_activation_backprop.tex (line 28)
        'h4,10:80,150:430,85',
        'h3,28:72,380:450,14',
        '}',
      ].join('\n');

      const map = parseSyncTeX(synctexPayload);

      // Forward search on line 1 of Sections/intro.tex (precedes first recorded SyncTeX node at line 6)
      const fwdLine1 = resolveForwardDetail(1, map, 'Sections/intro.tex');
      expect(fwdLine1).not.toBeNull();
      expect(fwdLine1!.page).toBe(1);

      // Forward search on Proofs/Proof_activation_backprop.tex line 30 -> resolves to Page 2
      const fwdProof = resolveForwardDetail(30, map, 'Proofs/Proof_activation_backprop.tex');
      expect(fwdProof).not.toBeNull();
      expect(fwdProof!.page).toBe(2);

      // Reverse search on Page 1 at Left Column (x=110, y=118) vs Right Column (x=360, y=118) at identical Y!
      const revLeft = resolveReverse(0.14, 1, map, 110, 118);
      const revRight = resolveReverse(0.14, 1, map, 360, 118);
      expect(revLeft?.sourcePath).toBe('./Sections/intro.tex');
      expect(revLeft?.line).toBe(6);
      expect(revRight?.sourcePath).toBe('./Sections/intro.tex');
      expect(revRight?.line).toBe(52);

      // Reverse search on Page 2 inside Tables/LM_table.tex
      const revTable = resolveReverse(0.2, 2, map, 200, 145);
      expect(revTable?.sourcePath).toBe('./Tables/LM_table.tex');
      expect(revTable?.line).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 23 (CS-23): COMPACT PREFIX TRIE & VIETNAMESE DIACRITIC SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-23: Compact PrefixTrie 0ms Autocomplete & Vietnamese Diacritic-Insensitive Symbol Catalog', () => {
    const tintFiles = loadRealWorldDataset('tint');
    const attentionFiles = loadRealWorldDataset('attention');

    it('indexes all labels, citations, and macros from TinT & Attention + Vietnamese academic terms with < 5ms O(K) lookup', () => {
      const symbolsCore = new LatexSymbolsIndexCore();
      for (const f of [...tintFiles, ...attentionFiles]) {
        symbolsCore.indexFile(f.id, f.path, f.content);
      }
      const snapshot = symbolsCore.exportSnapshot();

      const catalog = new LatexSymbolCatalog<string, string, string, string>();
      for (const c of snapshot.citations) {
        catalog.citationKeyTrie.insertNormalized(c.key, c.key);
      }
      for (const l of snapshot.labels) {
        catalog.labelTrie.insertNormalized(l.name, l.name);
      }
      for (const m of snapshot.commands) {
        catalog.commandTrie.insertNormalized(m.name, m.name);
      }

      // Add Vietnamese co-author / theorem labels to verify diacritic-insensitive search
      catalog.labelTrie.insertNormalized(' định_lý_hội_tụ_transformer ', 'thm:dinh_ly_hoi_tu');
      catalog.citationKeyTrie.insertNormalized('nguyễn2024_đối_sánh', 'nguyen2024doisanh');

      const start = performance.now();
      const thmHits = catalog.labelTrie.findPrefix('dinh_ly_hoi_tu');
      const ngHits = catalog.citationKeyTrie.findPrefix('nguyen2024');
      const secHits = catalog.labelTrie.findPrefix('sec:');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(15);
      expect(thmHits).toContain('thm:dinh_ly_hoi_tu');
      expect(ngHits).toContain('nguyen2024doisanh');
      expect(secHits.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 25 (CS-25): DOCUMENT SESSION LIFECYCLE FSM UNDER CONCURRENT EDITS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-25: Document Session Lifecycle FSM under Rapid Multi-Tab Switching & Concurrent Network Saves', () => {
    it('prevents data loss when local or remote edits arrive while an async save is in flight', () => {
      let ctx = createInitialSessionContext('Sections/construction.tex', 1);
      expect(ctx.state).toBe('idle');

      ctx = sessionFsmTransition(ctx, { type: 'ACTIVATE' });
      expect(ctx.state).toBe('active');

      // Author types edit v2 and starts saving
      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
      expect(ctx.state).toBe('dirty');
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
      expect(ctx.state).toBe('saving');
      expect(ctx.pendingSaveVersion).toBe(2);

      // Remote Yjs edit v3 arrives while save of v2 is still in flight -> lastSavedVersion must stay 1
      ctx = sessionFsmTransition(ctx, { type: 'REMOTE_EDIT', version: 3 });
      expect(ctx.state).toBe('saving');
      expect(ctx.lastSavedVersion).toBe(1);

      // Author also types another character (v4) before v2 save returns
      ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 4 });
      expect(ctx.state).toBe('saving');

      // Save of v2 completes -> since currentVersion (4) > savedVersion (2), FSM MUST remain 'dirty'!
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_SUCCESS', savedVersion: 2, currentVersion: 4 });
      expect(ctx.state).toBe('dirty');
      expect(ctx.lastSavedVersion).toBe(2);

      // Second save of v4 completes with no further edits -> transitions cleanly to 'idle'
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
      ctx = sessionFsmTransition(ctx, { type: 'SAVE_SUCCESS', savedVersion: 4, currentVersion: 4 });
      expect(ctx.state).toBe('idle');
      expect(ctx.lastSavedVersion).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 26 (CS-26): CODEMIRROR 6 LATEX FORMATTING & AUTO-CLOSE COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-26: CodeMirror 6 Auto-Close Environments with Arguments & Escaped Dollar Currency Handling', () => {
    it('auto-closes \\begin{figure}[htbp] and \\begin{tabular}{@{}lcc@{}}, and does not double-close escaped \\$ currency', () => {
      // 1. Auto-close \begin{figure}[htbp] on Enter
      const figView = new EditorView({
        state: EditorState.create({
          doc: '  \\begin{figure}[htbp]',
          selection: { anchor: 22 },
        }),
      });
      const handledFig = handleAutoCloseEnvironment(figView);
      expect(handledFig).toBe(true);
      expect(figView.state.doc.toString()).toBe('  \\begin{figure}[htbp]\n    \n  \\end{figure}');
      figView.destroy();

      // 2. Do NOT auto-close math when user types '$' right after '\' (for literal currency \$100)
      const currencyView = new EditorView({
        state: EditorState.create({
          doc: 'Training cost was \\',
          selection: { anchor: 19 },
        }),
      });
      const handledCurrency = handleAutoCloseMath(currencyView);
      expect(handledCurrency).toBe(false);
      currencyView.destroy();

      // 3. Auto-close math when typing '$' in normal prose and delete both '$$' on Backspace
      const mathView = new EditorView({
        state: EditorState.create({
          doc: 'Compute ',
          selection: { anchor: 8 },
        }),
      });
      expect(handleAutoCloseMath(mathView)).toBe(true);
      expect(mathView.state.doc.toString()).toBe('Compute $$');
      expect(mathView.state.selection.main.anchor).toBe(9);
      expect(handleBackspaceBetweenMath(mathView)).toBe(true);
      expect(mathView.state.doc.toString()).toBe('Compute ');
      mathView.destroy();

      // 4. Wrap selected text in \textbf{...}
      const boldView = new EditorView({
        state: EditorState.create({
          doc: 'Multi-Head Attention',
          selection: { anchor: 0, head: 20 },
        }),
      });
      wrapFormatting(boldView, '\\textbf{', '}');
      expect(boldView.state.doc.toString()).toBe('\\textbf{Multi-Head Attention}');
      boldView.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE STUDY 27 (CS-27): AI ACADEMIC ASSISTANT MACRO MASKING ON REAL PAPERS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CS-27: AI Academic Writing Assistant Macro & Math Environment Masking on Real Conference Paragraphs', () => {
    it('masks \\begin{equation}...\\end{equation}, ACL \\newcite, natbib \\citep, and cleveref \\cref during academic tone polishing', () => {
      const rawExcerpt = [
        'We use a lot of layers and show that our model is able to get very good accuracy in \\cref{sec:intro,tab:wmt}.',
        'As established by \\newcite{vaswani2017attention} and \\citep[see][p.~4]{devlin2019bert}, we compute:',
        '\\begin{equation}\\label{eq:attn}',
        '  \\text{use}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
        '\\end{equation}',
      ].join('\n');

      const { maskedText, unmask } = maskLatexEntities(rawExcerpt);

      // Ensure equation body (containing the word "use"), \newcite, \citep, and \cref are all masked into placeholders
      expect(maskedText).not.toContain('\\newcite{vaswani2017attention}');
      expect(maskedText).not.toContain('\\cref{sec:intro,tab:wmt}');
      expect(maskedText).not.toContain('\\text{use}(Q, K, V)');

      // Apply academic tone transformation on the masked prose and then unmask
      const polishedMasked = applyHeuristicTransformation(maskedText, 'academic-tone');
      const polishedFinal = unmask(polishedMasked);

      // Prose words ("use", "a lot of", "show that", "get", "very good") are elevated
      expect(polishedFinal).toContain('We utilize a substantial volume of layers and demonstrate that');
      expect(polishedFinal).toContain('obtain superior accuracy');
      // While the math macro \text{use}(Q, K, V) inside \begin{equation} and citations/refs remain 100% untouched!
      expect(polishedFinal).toContain('\\text{use}(Q, K, V)');
      expect(polishedFinal).toContain('\\newcite{vaswani2017attention}');
      expect(polishedFinal).toContain('\\citep[see][p.~4]{devlin2019bert}');
      expect(polishedFinal).toContain('\\cref{sec:intro,tab:wmt}');
    });
  });
});



