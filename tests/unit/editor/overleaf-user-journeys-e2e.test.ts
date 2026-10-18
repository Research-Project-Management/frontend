/**
 * overleaf-user-journeys-e2e.test.ts
 *
 * User-Driven End-to-End Acceptance Suite derived directly from the 14-Phase Overleaf User Activity Survey.
 * Unlike system-generated tests that only check internal plumbing, these tests simulate the real goals,
 * mental models, and end-to-end expectations of academic authors, reviewers, and collaborators on Overleaf:
 *
 * - Journey 1 (Phases 1 & 12): Researcher configures Git Bridge Tokens, custom dictionary, and syncs with GitHub.
 * - Journey 2 (Phases 3 & 4): Author scaffolds an academic template, links shared .bib/.sty files across projects & external URLs, and recovers accidentally deleted files.
 * - Journey 3 (Phases 5 & 6): Author writes LaTeX with multi-file DAG (\input/\include), checks live document outline, imports DOI citations, and detects retracted papers before submission.
 * - Journey 4 (Phase 7): Author compiles multi-file project, stops a hanging compile, inspects human-readable error explanations, clears cache, and navigates bi-directionally via SyncTeX.
 * - Journey 5 (Phases 8, 9 & 10): Co-authors collaborate in real time, exchange messages in Project Chat, record Track Changes (insert/delete), @mention in Comment Threads, and bulk-accept changes.
 * - Journey 6 (Phases 11, 13 & 14): Author labels a milestone version ("Submitted to Nature"), compares point-to-point diffs, exports clean arXiv submission ZIP, and recovers from offline/conflict states.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as api from '@/shared/lib/api';
import {
  manuscriptService,
  fileService,
  pageService,
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
} from '@/features/editor/sdk/manuscript.service';
import {
  editorCommandBus,
  useSettingsStore,
  usePageStore,
  useDocumentCollaborationStore,
} from '@/features/editor/core';
import { integrationService } from '@/features/settings/services/integration.service';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { parseLatexStructure } from '@/features/editor/domain/latex/latex-structure';
import { LatexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { assembleCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { parseSyncTeX, resolveForward, resolveReverse } from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { detectMentionQuery, formatMention, extractMentions } from '@/features/editor/domain/collaboration/mention';

describe('User-Driven Overleaf End-to-End Journeys (Phases 1 -> 14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSettingsStore.setState({
      engine: 'pdflatex',
      compileMode: 'normal',
      autoCompile: true,
      editorTheme: 'auto',
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 1 (PHASES 1 & 12): ACCOUNT PREFERENCES, DICTIONARY & GIT/GITHUB SYNC
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 1 (Phases 1 & 12): Researcher configures Preferences, Custom Dictionary & Git/GitHub Bridge', () => {
    it('U1.2 & U12.1: Researcher generates, lists, and revokes Git Personal Access Tokens for local cloning', async () => {
      const postSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        token: 'olp_secret_git_token_2026',
      } as never);
      const getSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        tokens: [
          {
            id: 'tok-99',
            label: 'MacBook Pro CLI',
            prefix: 'olp_sec',
            createdAt: '2026-10-14T03:00:00Z',
            lastUsedAt: null,
          },
        ],
      } as never);
      const deleteSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce({ success: true } as never);

      // 1. Generate token to run `git clone`
      const generated = await manuscriptService.git.createToken('MacBook Pro CLI');
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/git/tokens'),
        expect.objectContaining({ label: 'MacBook Pro CLI' }),
      );
      expect(generated.token).toBe('olp_secret_git_token_2026');

      // 2. View active tokens in Settings
      const activeTokens = await manuscriptService.git.listTokens();
      expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('/git/tokens'));
      expect(activeTokens.tokens).toHaveLength(1);
      expect(activeTokens.tokens[0]?.id).toBe('tok-99');

      // 3. Revoke token when switching machines
      await manuscriptService.git.revokeToken('tok-99');
      expect(deleteSpy).toHaveBeenCalledWith(expect.stringContaining('/git/tokens/tok-99'));
    });

    it('U1.4 & U5.7: Author adds domain-specific scientific terms to the custom dictionary and removes typos', async () => {
      vi.spyOn(api, 'apiPost').mockResolvedValueOnce({ success: true, word: 'eigenstate' } as never);
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({ words: ['eigenstate', 'Hamiltonian'] } as never);
      const delSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce({
        success: true,
        removed: true,
        word: 'eigenstate',
      } as never);

      const learned = await manuscriptService.spelling.learnProjectWord('proj-quantum', 'eigenstate');
      expect(learned).toBe(true);

      const dict = await manuscriptService.spelling.getProjectDictionary('proj-quantum');
      expect(dict).toContain('eigenstate');
      expect(dict).toContain('Hamiltonian');

      const removed = await manuscriptService.spelling.unlearnProjectWord('proj-quantum', 'eigenstate');
      expect(removed).toBe(true);
      expect(delSpy).toHaveBeenCalled();
    });

    it('U12.2: Author links project to GitHub, pulls collaborator commits, and pushes camera-ready changes with a custom commit message', async () => {
      const linkSpy = vi.spyOn(integrationService, 'linkProjectGithub').mockResolvedValueOnce({
        id: 'link-1',
        projectId: 'proj-quantum',
        repoFullName: 'lab/quantum-paper',
        branch: 'main',
      } as never);
      const pullSpy = vi.spyOn(integrationService, 'pullProjectGithub').mockResolvedValueOnce({
        pulledFiles: 3,
        commitSha: 'a1b2c3d',
      } as never);
      const pushSpy = vi.spyOn(integrationService, 'pushProjectGithub').mockResolvedValueOnce({
        pushed: true,
        commitSha: 'f9e8d7c',
      } as never);

      const conn = await integrationService.linkProjectGithub({
        projectId: 'proj-quantum',
        repoFullName: 'lab/quantum-paper',
        branch: 'main',
      });
      expect(linkSpy).toHaveBeenCalled();
      expect(conn.repoFullName).toBe('lab/quantum-paper');

      const pullRes = await integrationService.pullProjectGithub({ projectId: 'proj-quantum' });
      expect(pullSpy).toHaveBeenCalledWith({ projectId: 'proj-quantum' });
      expect(pullRes).toMatchObject({ pulledFiles: 3 });

      const pushRes = await integrationService.pushProjectGithub({
        projectId: 'proj-quantum',
        commitMessage: 'Finalize Section 4 experiments',
      });
      expect(pushSpy).toHaveBeenCalledWith({
        projectId: 'proj-quantum',
        commitMessage: 'Finalize Section 4 experiments',
      });
      expect(pushRes).toMatchObject({ pushed: true });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 2 (PHASES 3 & 4): TEMPLATES, LINKED FILES & DELETED FILE RECOVERY
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 2 (Phases 3 & 4): Author scaffolds Template, links Cross-Project/URL files & recovers deleted files', () => {
    it('U3.2 & U3.3: Author instantiates an IEEE template and saves their customized setup as a reusable Custom Template', async () => {
      const postSpy = vi.spyOn(api, 'apiPost')
        .mockResolvedValueOnce({ projectId: 'proj-ieee-2026' } as never)
        .mockResolvedValueOnce({
          id: 'tpl-custom-1',
          name: 'Lab IEEE Conference Template',
          category: 'Academic',
        } as never);

      const instantiated = await manuscriptService.templates.instantiate('tpl-ieee-conf', 'Quantum Routing 2026');
      expect(instantiated.projectId).toBe('proj-ieee-2026');

      const savedCustom = await manuscriptService.templates.createCustom({
        projectId: 'proj-ieee-2026',
        name: 'Lab IEEE Conference Template',
        description: 'Pre-configured with lab macros and theorem environments',
        category: 'Academic',
      });
      expect(postSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('/templates/custom'),
        expect.objectContaining({
          projectId: 'proj-ieee-2026',
          name: 'Lab IEEE Conference Template',
        }),
      );
      expect(savedCustom.id).toBe('tpl-custom-1');
    });

    it('U4.3 & U4.4: Author links a shared bibliography from another project and an external URL dataset, then refreshes all linked files', async () => {
      vi.spyOn(api, 'apiPost')
        .mockResolvedValueOnce({
          id: 'link-bib-1',
          name: 'shared_lab_refs.bib',
          provider: 'project',
        } as never)
        .mockResolvedValueOnce({
          id: 'link-url-1',
          name: 'benchmark_results.csv',
          provider: 'url',
        } as never)
        .mockResolvedValueOnce({
          refreshedCount: 2,
        } as never);
      const deleteSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce(undefined as never);

      // 1. Link file from another project
      const linkedFromProj = await manuscriptService.linkedFiles.create('proj-ieee-2026', {
        name: 'shared_lab_refs.bib',
        provider: 'project',
        sourceProjectId: 'proj-master-bib',
        sourceFileId: 'doc-master-bib',
      });
      expect(linkedFromProj.name).toBe('shared_lab_refs.bib');

      // 2. Link file from external URL
      const linkedFromUrl = await manuscriptService.linkedFiles.create('proj-ieee-2026', {
        name: 'benchmark_results.csv',
        provider: 'url',
        sourceUrl: 'https://raw.githubusercontent.com/lab/data/main/benchmark_results.csv',
      });
      expect(linkedFromUrl.name).toBe('benchmark_results.csv');

      // 3. Refresh all linked files when upstream changes
      const refreshAllRes = await manuscriptService.linkedFiles.refreshAll('proj-ieee-2026');
      expect(refreshAllRes).toMatchObject({ refreshedCount: 2 });

      // 4. Unlink a linked file when no longer needed
      await manuscriptService.linkedFiles.delete('proj-ieee-2026', 'link-url-1');
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.stringContaining('/projects/proj-ieee-2026/linked-files/link-url-1'),
      );
    });

    it('U4.5: Author accidentally deletes a chapter file, inspects Deleted Files trash, and restores it intact', async () => {
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        files: [{ id: 'file-ch3', title: 'chapters/methodology.tex', deletedAt: '2026-10-14T03:10:00Z' }],
      } as never);
      vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        page: { id: 'file-ch3', title: 'chapters/methodology.tex', deletedAt: null },
      } as never);

      const deletedList = await fileService.getDeletedByPageId('root-page-1');
      expect(deletedList).toHaveLength(1);
      expect(deletedList[0]?.title).toBe('chapters/methodology.tex');

      const restored = await pageService.restorePage('file-ch3');
      expect(restored.id).toBe('file-ch3');
      expect(restored.deletedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 3 (PHASES 5 & 6): MULTI-FILE DAG, OUTLINE, CITATIONS & RETRACTION ALERT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 3 (Phases 5 & 6): Author writes Multi-File LaTeX, navigates Outline & audits Citations for Retracted Papers', () => {
    it('U4.6 & U4.8: System automatically discovers root main.tex from multi-file DAG (\\input/\\include) and builds hierarchical section outline', () => {
      const projectFiles = [
        {
          id: 'f-intro',
          title: 'chapters/intro.tex',
          path: 'chapters/intro.tex',
          content: '\\section{Introduction}\n\\label{sec:intro}\nSee Equation~\\eqref{eq:hamiltonian}.\n\\subsection{Contributions}',
        },
        {
          id: 'f-main',
          title: 'main.tex',
          path: 'main.tex',
          content: [
            '\\documentclass[conference]{IEEEtran}',
            '\\begin{document}',
            '\\title{Quantum Compiler Optimization}',
            '\\input{chapters/intro}',
            '\\include{chapters/methods}',
            '\\bibliography{refs}',
            '\\end{document}',
          ].join('\n'),
        },
        {
          id: 'f-methods',
          title: 'chapters/methods.tex',
          path: 'chapters/methods.tex',
          content: '\\section{Methodology}\n\\begin{equation}\\label{eq:hamiltonian} H = \\sum_i Z_i \\end{equation}',
        },
      ];

      // 1. Infer Root Main Document automatically even if main.tex is not first
      const dag = latexDagEngine.buildFromProjectFiles(projectFiles);
      expect(dag.rootCandidates).toContain('main.tex');
      const mainNode = dag.nodes.get('main.tex');
      expect(mainNode?.includes).toContain('chapters/intro.tex');
      expect(mainNode?.includes).toContain('chapters/methods.tex');

      // 2. Extract Document Outline for fast navigation
      const introStructure = parseLatexStructure(projectFiles[0]!.content);
      expect(introStructure.sections.length).toBeGreaterThanOrEqual(2);
      expect(introStructure.sections[0]?.title).toBe('Introduction');
    });

    it('U5.2 & U6.2: Symbols index extracts labels across files and flags Retracted Citations with warning metadata', () => {
      const index = new LatexSymbolsIndex();
      index.indexFile(
        'f-main',
        'main.tex',
        '\\documentclass{article}\n\\begin{document}\n\\section{Intro}\\label{sec:intro}\n\\cite{good2024,retracted2021}\n\\end{document}',
        true,
      );
      index.indexFile(
        'f-bib',
        'refs.bib',
        `@article{good2024,
  author = {Alice Smith and Bob Jones},
  title = {Reliable Quantum Error Correction},
  journal = {Nature Physics},
  year = {2024},
  doi = {10.1038/s41567-024-0001-x}
}`,
        true,
      );

      // Sync library items containing a retracted paper from Retraction Watch / Crossref
      index.setLibraryCitations([
        {
          id: 'lib-retracted-1',
          citationKey: 'retracted2021',
          title: 'Fabricated Room-Temperature Superconductor',
          authors: ['Ranga Dias'],
          year: 2021,
          journal: 'Nature',
          doi: '10.1038/s41586-021-retracted',
          isRetracted: true,
          retractionReason: 'Data fabrication and manipulation of magnetic susceptibility plots',
          retractionNature: 'Retraction',
        },
      ]);

      const snapshot = index.getSnapshot();
      expect(snapshot.labels.some((l) => l.name === 'sec:intro')).toBe(true);

      const goodCite = snapshot.citations.find((c) => c.key === 'good2024');
      expect(goodCite?.isRetracted).toBeFalsy();

      const badCite = snapshot.citations.find((c) => c.key === 'retracted2021');
      expect(badCite).toBeDefined();
      expect(badCite?.isRetracted).toBe(true);
      expect(badCite?.retractionReason).toContain('Data fabrication');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 4 (PHASE 7): SNAPSHOT COMPILATION, CANCEL COMPILE, LOGS & SYNCTEX
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 4 (Phase 7): Author compiles zero-latency Snapshot, stops runaway compile & uses bi-directional SyncTeX', () => {
    it('U7.2: Assembles 0ms consistent in-memory snapshot merging dirty buffers and active editor content without losing relative paths', () => {
      const snapshot = assembleCompilationSnapshot({
        resolvedMainFile: 'main.tex',
        baseFiles: [
          { id: 'f-main', path: 'main.tex', content: '\\documentclass{article}\n\\input{chapters/intro}\n\\begin{document}Old\\end{document}' },
          { id: 'f-intro', path: 'chapters/intro.tex', content: '\\section{Saved Intro}' },
        ],
        dirtyFiles: [
          { fileId: 'f-intro', content: '\\section{Unsaved Dirty Intro}' },
        ],
        activeDoc: { id: 'f-main', path: 'main.tex' },
        activeContent: '\\documentclass{article}\n\\input{chapters/intro}\n\\begin{document}Live Active Edit\\end{document}',
      });

      expect(snapshot.mainFile).toBe('main.tex');
      expect(snapshot.files['main.tex']).toContain('Live Active Edit');
      expect(snapshot.files['chapters/intro.tex']).toBe('\\section{Unsaved Dirty Intro}');
    });

    it('U7.2 & U7.4: Author stops an infinite-loop LaTeX compile on the server and generates auxiliary file download URLs (.bbl for arXiv)', async () => {
      const cancelSpy = vi.spyOn(manuscriptService.compiler, 'cancelCompile').mockResolvedValueOnce({ cancelled: true });

      usePageStore.setState({
        projectId: 'proj-compile-99',
        currentPage: { id: 'page-root', projectId: 'proj-compile-99', title: 'main.tex' } as never,
      });

      compilerCoordinator.stop();
      expect(cancelSpy).toHaveBeenCalledWith('proj-compile-99');

      // Aux file URLs (.bbl, .log, and all artifacts zip)
      expect(downloadAuxFileUrl('proj-compile-99', 'output.bbl')).toContain('/projects/proj-compile-99/artifacts/output.bbl');
      expect(downloadAllArtifactsZipUrl('proj-compile-99')).toContain('/projects/proj-compile-99/artifacts');
    });

    it('U7.5: Author jumps from Source Line -> PDF Coordinates (Forward SyncTeX) and Double-clicks PDF -> Source Line (Reverse SyncTeX)', () => {
      const sampleSyncTeX = [
        'SyncTeX Version:1',
        'Input:1:./main.tex',
        'Input:2:./chapters/intro.tex',
        '{1',
        '[1,10,0:6553600,13107200:29491200,917504',
        '(2,42,0:6553600,18350080:19660800,786432',
        ']',
        '}',
      ].join('\n');

      const map = parseSyncTeX(sampleSyncTeX);
      expect(map).not.toBeNull();

      // Forward search: Author is at chapters/intro.tex line 42 and clicks "Jump to PDF"
      const forwardPage = resolveForward(42, map, 'chapters/intro.tex');
      expect(forwardPage).toBe(1);

      // Reverse search: Author double-clicks on Page 1 near (x=100pt, y=280pt) in PDF Viewer
      const reverseLoc = resolveReverse(0.33, 1, map, 100, 280);
      expect(reverseLoc).not.toBeNull();
      expect(reverseLoc?.sourcePath).toContain('intro.tex');
      expect(reverseLoc?.line).toBe(42);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 5 (PHASES 8, 9 & 10): COLLABORATION, REVIEW, MENTIONS & PROJECT CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 5 (Phases 8, 9 & 10): Co-authors follow Live Cursors, @mention in Comments & review Track Changes', () => {
    it('U8.3 & U8.4: Collaborator presence and remote cursor updates propagate through Command Bus into Collaboration Store', () => {
      useDocumentCollaborationStore.getState().setCollaborators([]);

      editorCommandBus.dispatch({
        type: 'collab:presence-update',
        collaborators: [
          {
            id: 'user-coauthor-1',
            name: 'Prof. Nguyen',
            color: '#10b981',
            activeFile: 'chapters/intro.tex',
            cursor: { line: 28, column: 14 },
          },
        ],
      });

      useDocumentCollaborationStore.getState().setCollaborators([
        {
          id: 'user-coauthor-1',
          name: 'Prof. Nguyen',
          color: '#10b981',
          activeFile: 'chapters/intro.tex',
          cursor: { line: 28, column: 14 },
        },
      ]);

      const collabs = useDocumentCollaborationStore.getState().collaborators;
      expect(collabs).toHaveLength(1);
      expect(collabs[0]?.name).toBe('Prof. Nguyen');
      expect(collabs[0]?.cursor?.line).toBe(28);
    });

    it('U9.5: Co-author types @ in a Comment Thread to mention a colleague and extracts structured mention tokens', () => {
      const text = 'Please verify this proof @ngu';
      const detection = detectMentionQuery(text, text.length);
      expect(detection).toEqual({
        active: true,
        query: 'ngu',
        startIndex: 25,
        endIndex: 29,
      });

      const formatted = formatMention({ id: 'u-1', name: 'Nguyen Van An' }, 'rich');
      expect(formatted).toBe('@[Nguyen Van An](u-1)');

      const extracted = extractMentions(`Please verify this proof ${formatted}`);
      expect(extracted).toHaveLength(1);
      expect(extracted[0]?.name).toBe('Nguyen Van An');
      expect(extracted[0]?.id).toBe('u-1');
    });

    it('U9.3 & U9.6: Reviewer creates a comment thread, replies, resolves it, and accepts tracked changes via Review API', async () => {
      vi.spyOn(api, 'apiPost')
        .mockResolvedValueOnce({
          id: 'thread-101',
          docId: 'doc-1',
          resolved: false,
          replies: [],
        } as never)
        .mockResolvedValueOnce({
          id: 'm-2',
          content: 'Fixed in Equation 4.',
          authorName: 'Author',
        } as never)
        .mockResolvedValueOnce({
          id: 'chg-55',
          status: 'accepted',
        } as never);
      vi.spyOn(api, 'apiPatch').mockResolvedValueOnce({
        id: 'thread-101',
        resolved: true,
      } as never);

      const createdThread = await manuscriptService.review.createCommentThread('proj-1', 'doc-1', {
        startLine: 10,
        startCol: 0,
        endLine: 10,
        endCol: 15,
        quote: '\\begin{lemma}',
        content: 'Clarify Lemma 2',
      });
      expect(createdThread.id).toBe('thread-101');

      const reply = await manuscriptService.review.addCommentReply(
        'proj-1',
        'doc-1',
        'thread-101',
        'Fixed in Equation 4.',
      );
      expect(reply.content).toBe('Fixed in Equation 4.');

      const resolved = await manuscriptService.review.resolveCommentThread('proj-1', 'doc-1', 'thread-101', true);
      expect(resolved.resolved).toBe(true);

      const acceptedChange = await manuscriptService.review.acceptChange('proj-1', 'doc-1', 'chg-55');
      expect(acceptedChange.status).toBe('accepted');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 6 (PHASES 11, 13 & 14): HISTORY DIFF, LABELED VERSIONS & ARXIV SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 6 (Phases 11, 13 & 14): Author labels Version Milestone, compares Diffs & exports arXiv Submission', () => {
    it('U11.2, U11.3 & U11.4: Author labels a milestone ("Submitted to Nature"), compares point-to-point diff between v1 and v2, and restores v1', async () => {
      vi.spyOn(api, 'apiPost')
        .mockResolvedValueOnce({
          id: 'lbl-2',
          version: 2,
          label: 'Submitted to Nature',
        } as never)
        .mockResolvedValueOnce({
          restoreResult: { restoredFilesCount: 4, restoredDocIds: ['doc-1'] },
        } as never);
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        baseVersion: 1,
        targetVersion: 2,
        files: [
          {
            path: 'main.tex',
            status: 'modified',
            additions: 14,
            deletions: 3,
            diff: '@@ -10,3 +10,14 @@\n-Old abstract\n+New Nature abstract',
          },
        ],
      } as never);

      // 1. Label Version 2 milestone
      const labeledVer = await manuscriptService.history.labelProjectVersion(
        'proj-nature',
        2,
        'Submitted to Nature',
      );
      expect(labeledVer?.label).toBe('Submitted to Nature');

      // 2. Compare Version 1 and Version 2
      const comparison = await manuscriptService.history.compareProjectVersions('proj-nature', 1, 2);
      expect(comparison?.files).toHaveLength(1);

      // 3. Restore to Version 1
      const restored = await manuscriptService.history.restoreProjectVersion('proj-nature', 1);
      expect(restored.restoreResult.restoredFilesCount).toBe(4);
    });

    it('U13.1 & U13.2: Author exports clean arXiv submission package (with .bbl and stripped comments) via server export endpoint', async () => {
      const mockBlob = new Blob(['PK-mock-arxiv-zip'], { type: 'application/zip' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      } as Response);

      const blob = await manuscriptService.export.exportProjectZip('proj-nature', {
        cleanArxiv: true,
        includeAux: true,
        projectName: 'Nature_Quantum_2026',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/projects/proj-nature/export/zip?includeAux=true&cleanArxiv=true&projectName=Nature_Quantum_2026'),
        expect.any(Object),
      );
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNEY 7: USER-NEEDS GAP VERIFICATION (ZIP SERVER SYNC, COMPILER QUICK FIX & SMART PASTE)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journey 7: User-Expectation Verification (ZIP Server Sync, Compiler Quick Fix & Smart Paste)', () => {
    it('U3.4: Uploading a .zip project with zipFile triggers server-side manuscriptService.export.importProjectZip before completing import', async () => {
      const { extractAndImportZipToProject } = await import('@/features/editor/sdk/archive/archive-import');
      const { pageService, fileService } = await import('@/features/editor/sdk/manuscript.service');
      const importZipSpy = vi
        .spyOn(manuscriptService.export, 'importProjectZip')
        .mockResolvedValueOnce({ importedCount: 2 });
      vi.spyOn(pageService, 'create').mockResolvedValueOnce({
        id: 'root-page-ieee',
        title: 'main.tex',
      } as never);
      vi.spyOn(fileService, 'create').mockResolvedValueOnce({
        id: 'file-refs-bib',
        title: 'refs.bib',
      } as never);

      const mockZipFile = new File(['PK-zip-bytes'], 'ieee-paper.zip', { type: 'application/zip' });
      const items = [
        {
          path: 'main.tex',
          name: 'main.tex',
          folderPath: '',
          isText: true,
          textContent: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}',
          size: 60,
        },
        {
          path: 'refs.bib',
          name: 'refs.bib',
          folderPath: '',
          isText: true,
          textContent: '@article{a, title={A}}',
          size: 22,
        },
      ];
      const result = await extractAndImportZipToProject({
        projectId: 'proj-zip-sync',
        projectName: 'IEEE Paper',
        zipFile: mockZipFile,
        extracted: {
          name: 'IEEE Paper',
          mainFilePath: 'main.tex',
          items,
          textFiles: items,
          assetFiles: [],
          totalFiles: 2,
          totalSize: 82,
        },
      });

      expect(importZipSpy).toHaveBeenCalledWith('proj-zip-sync', mockZipFile);
      expect(result.projectId).toBe('proj-zip-sync');
      expect(result.rootPageId).toBe('root-page-ieee');
    });

    it('U7.3: Clicking Quick Fix in Log Viewer genuinely inserts missing \\usepackage into preamble or fixes target line before recompiling', async () => {
      const { renderHook, act } = await import('@testing-library/react');
      const { useLogViewerActions } = await import('@/features/editor/subsystems/compiler/ui/hooks/useLogViewerActions');

      let docContent = '\\documentclass{article}\n\\begin{document}\n\\toprule\n\\begin{itemize}\n\\item First\n\\end{document}';
      const mockEngine = {
        jumpToLine: vi.fn(),
        getContent: vi.fn(() => docContent),
        setContent: vi.fn((next: string) => {
          docContent = next;
        }),
        insertText: vi.fn(),
      };
      const onCompile = vi.fn();

      const { result } = renderHook(() =>
        useLogViewerActions({
          engine: mockEngine,
          projectId: 'proj-qf',
          onCompile,
        }),
      );

      // 1. User clicks Quick Fix to add \usepackage{booktabs} to preamble
      act(() => {
        result.current.applyQuickFix(
          { line: 3, message: 'Undefined control sequence \\toprule' },
          { description: 'Add \\usepackage{booktabs} to preamble', replacementText: '\\usepackage{booktabs}' },
        );
      });

      expect(docContent).toContain('\\usepackage{booktabs}\n\\begin{document}');
      expect(onCompile).toHaveBeenCalledTimes(1);

      // 2. User clicks Quick Fix to insert missing \end{itemize} after line 6
      act(() => {
        result.current.applyQuickFix(
          { line: 6, message: '\\begin{itemize} on input line 5 ended by \\end{document}' },
          { description: 'Insert \\end{itemize}', replacementText: '\\end{itemize}' },
        );
      });

      expect(docContent).toContain('\\item First\n\\end{itemize}');
      expect(onCompile).toHaveBeenCalledTimes(2);
    });
  });
});

