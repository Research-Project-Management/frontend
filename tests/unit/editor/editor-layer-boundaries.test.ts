// @vitest-environment node
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSearchStore } from '@/features/editor/core/store/search.store';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { warmEditorStatePool } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { useCompileStore, useViewerStore } from '@/features/editor/subsystems/compiler';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { resetEditorWorkspace } from '@/features/editor/editor-workspace-lifecycle';

const EDITOR_ROOT = path.resolve(__dirname, '../../../src/features/editor');

function collectTsFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractModuleSpecifiers(source: string): {
  staticSpecifiers: string[];
  dynamicSpecifiers: string[];
} {
  const staticSpecifiers: string[] = [];
  const dynamicSpecifiers: string[] = [];

  const staticRegex = /^\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = staticRegex.exec(source)) !== null) {
    staticSpecifiers.push(match[1]);
  }

  const dynamicRegex = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(source)) !== null) {
    dynamicSpecifiers.push(match[1]);
  }

  return { staticSpecifiers, dynamicSpecifiers };
}

function toPosixRelative(absPath: string): string {
  return path.relative(EDITOR_ROOT, absPath).replace(/\\/g, '/');
}

describe('Editor Architecture Layer Boundaries & Workspace Teardown', () => {
  describe('1. Static Layer Direction Guards', () => {
    it('keeps domain/ 100% pure with zero imports from core, subsystems, sdk, react, or zustand', () => {
      const domainFiles = collectTsFiles(path.join(EDITOR_ROOT, 'domain'));
      expect(domainFiles.length).toBeGreaterThan(20);

      const violations: string[] = [];
      for (const file of domainFiles) {
        const { staticSpecifiers, dynamicSpecifiers } = extractModuleSpecifiers(
          fs.readFileSync(file, 'utf8'),
        );
        for (const spec of [...staticSpecifiers, ...dynamicSpecifiers]) {
          if (
            /^@\/features\/editor\/(core|subsystems|sdk)(?:\/|$)/.test(spec) ||
            spec === 'react' ||
            spec.startsWith('react/') ||
            spec === 'zustand' ||
            spec.startsWith('zustand/')
          ) {
            violations.push(`${toPosixRelative(file)} -> ${spec}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('prevents sdk/ from importing subsystems/, core/shell/, core/surface/, or react', () => {
      const sdkFiles = collectTsFiles(path.join(EDITOR_ROOT, 'sdk'));
      expect(sdkFiles.length).toBeGreaterThan(10);

      const violations: string[] = [];
      for (const file of sdkFiles) {
        const { staticSpecifiers, dynamicSpecifiers } = extractModuleSpecifiers(
          fs.readFileSync(file, 'utf8'),
        );
        for (const spec of [...staticSpecifiers, ...dynamicSpecifiers]) {
          if (
            /^@\/features\/editor\/subsystems\//.test(spec) ||
            /^@\/features\/editor\/core\/(shell|surface)(?:\/|$)/.test(spec) ||
            spec === 'react' ||
            spec.startsWith('react/')
          ) {
            violations.push(`${toPosixRelative(file)} -> ${spec}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('forbids static subsystems/ imports or re-exports in core/index.ts, core/store/, core/collaboration/, and core/coordinator/', () => {
      const restrictedFiles = [
        path.join(EDITOR_ROOT, 'core/index.ts'),
        ...collectTsFiles(path.join(EDITOR_ROOT, 'core/store')),
        ...collectTsFiles(path.join(EDITOR_ROOT, 'core/collaboration')),
        ...collectTsFiles(path.join(EDITOR_ROOT, 'core/coordinator')),
      ];

      const violations: string[] = [];
      for (const file of restrictedFiles) {
        const { staticSpecifiers } = extractModuleSpecifiers(fs.readFileSync(file, 'utf8'));
        for (const spec of staticSpecifiers) {
          if (/^@\/features\/editor\/subsystems\//.test(spec)) {
            violations.push(`${toPosixRelative(file)} -> ${spec}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('forbids any core/ file from importing lruDocumentCache via subsystems/explorer or useSafeQueryClient via subsystems/review', () => {
      const coreFiles = collectTsFiles(path.join(EDITOR_ROOT, 'core'));
      const violations: string[] = [];

      for (const file of coreFiles) {
        const source = fs.readFileSync(file, 'utf8');
        if (
          /lruDocumentCache[\s\S]{0,120}subsystems\/explorer/.test(source) ||
          /useSafeQueryClient[\s\S]{0,120}subsystems\/review/.test(source)
        ) {
          violations.push(toPosixRelative(file));
        }
      }

      expect(violations).toEqual([]);
    });

    it('enforces subsystem entry-point boundaries (zero external deep imports past subsystems/<name>/index.ts)', () => {
      const srcRoot = path.resolve(EDITOR_ROOT, '../..');
      const allSrcFiles = collectTsFiles(srcRoot);
      const violations: string[] = [];

      for (const file of allSrcFiles) {
        const posixFile = file.replace(/\\/g, '/');
        const { staticSpecifiers, dynamicSpecifiers } = extractModuleSpecifiers(
          fs.readFileSync(file, 'utf8'),
        );
        for (const spec of [...staticSpecifiers, ...dynamicSpecifiers]) {
          const match = /^@\/features\/editor\/subsystems\/([^/]+)\/(.+)$/.exec(spec);
          if (!match) continue;
          const targetSub = match[1];
          if (!posixFile.includes(`/features/editor/subsystems/${targetSub}/`)) {
            violations.push(`${path.relative(srcRoot, file).replace(/\\/g, '/')} -> ${spec}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('2. Runtime Command Bus Decoupling & Centralized Workspace Reset', () => {
    beforeEach(() => {
      resetEditorWorkspace();
    });

    it('routes diagnostics:rename-path, diagnostics:remove-path, and diagnostics:clear via editorCommandBus', () => {
      diagnosticsCoordinator.ingestCompilerErrors(
        [
          {
            id: 'diag-1',
            file: 'sections/intro.tex',
            line: 10,
            column: 1,
            severity: 'error',
            message: 'Undefined control sequence',
            source: 'tex',
          },
          {
            id: 'diag-2',
            file: 'sections/methods.tex',
            line: 5,
            column: 1,
            severity: 'warning',
            message: 'Overfull \\hbox',
            source: 'tex',
          },
        ],
        'main.tex',
      );

      expect(diagnosticsCoordinator.getDiagnosticsForFile('sections/intro.tex', false)).toHaveLength(1);

      editorCommandBus.dispatch({
        type: 'diagnostics:rename-path',
        oldPath: 'sections/intro.tex',
        newPath: 'chapters/intro.tex',
      });
      expect(diagnosticsCoordinator.getFolderSummary('sections', false).errorCount).toBe(0);
      expect(diagnosticsCoordinator.getFolderSummary('sections', false).warningCount).toBe(1);
      const renamedItems = diagnosticsCoordinator.getDiagnosticsForFile('chapters/intro.tex', false);
      expect(renamedItems).toHaveLength(1);
      expect(renamedItems[0].file).toBe('chapters/intro.tex');

      editorCommandBus.dispatch({
        type: 'diagnostics:remove-path',
        filePath: 'chapters/intro.tex',
      });
      expect(diagnosticsCoordinator.getDiagnosticsForFile('chapters/intro.tex', false)).toHaveLength(0);
      expect(diagnosticsCoordinator.getDiagnosticsForFile('sections/methods.tex', false)).toHaveLength(1);

      editorCommandBus.dispatch({ type: 'diagnostics:clear' });
      expect(diagnosticsCoordinator.getAllDiagnostics(false)).toHaveLength(0);
    });

    it('resetEditorWorkspace() wipes all stores, diagnostics, indexes, and presence without state leakage', () => {
      // Populate stores & domain indexes
      useCompileStore.getState().setPdfUrl('blob:http://localhost/old-pdf');
      useCompileStore.getState().applyCompileResult({
        outcome: 'failure',
        errorMessage: 'Old compile error',
        diagnostics: [
          {
            file: 'main.tex',
            line: 3,
            message: 'Missing $ inserted',
            context: '',
            severity: 'error',
          },
        ],
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          totalBadboxes: 0,
          suppressedCascadeCount: 0,
          truncated: false,
        },
        validationIssues: [],
        logText: '! Missing $ inserted.',
        logMeta: null,
        compiledAt: null,
        mainFile: 'main.tex',
      });

      useViewerStore.getState().setScale(1.75);
      useViewerStore.getState().setInvertColors(true);
      usePageStore.getState().setProjectId('proj-old');
      useSearchStore.getState().setQuery('\\section');
      useCompileStore.getState().setLastCompiledAt(new Date());
      useCompileStore.getState().markSynced('old-file-1');
      warmEditorStatePool.put('old-file-1', {
        fileId: 'old-file-1',
        content: 'old cached tex',
        stateJson: {},
        foldedRanges: [],
        savedAt: Date.now(),
      });

      const collab = useDocumentCollaborationStore.getState();
      collab.setCollaborators([
        {
          id: 'u-1',
          userId: 'u-1',
          name: 'Alice',
          color: '#ff0000',
          isOnline: true,
        },
      ]);

      diagnosticsCoordinator.ingestCompilerErrors(
        [
          {
            id: 'd-old',
            file: 'main.tex',
            line: 3,
            column: 1,
            severity: 'error',
            message: 'Missing $ inserted',
            source: 'tex',
          },
        ],
        'main.tex',
      );
      latexSymbolsIndex.indexFile('f-1', 'main.tex', '\\label{sec:old}');
      latexDependencyGraph.parseAndRegister('main.tex', '\\input{chapters/old}', 'f-1');

      expect(useCompileStore.getState().compileOutcome).toBe('failure');
      expect(useCompileStore.getState().compileDiagnostics).toHaveLength(1);
      expect(useSearchStore.getState().query).toBe('\\section');
      expect(useDocumentCollaborationStore.getState().collaborators).toHaveLength(1);
      expect(diagnosticsCoordinator.getAllDiagnostics(false)).toHaveLength(1);
      expect(warmEditorStatePool.size).toBe(1);

      // Act: centralized reset
      resetEditorWorkspace();

      // Assert zero leakage across every store, coordinator, and index
      const compileAfter = useCompileStore.getState();
      expect(compileAfter.compileOutcome).toBeNull();
      expect(compileAfter.compilePhase).toBe('idle');
      expect(compileAfter.compileStatus).toBe('idle');
      expect(compileAfter.compileReport).toBeNull();
      expect(compileAfter.compileLog).toBeNull();
      expect(compileAfter.compileDiagnostics).toEqual([]);
      expect(compileAfter.parsedLog).toBeNull();
      expect(compileAfter.compileErrors).toEqual([]);
      expect(compileAfter.lastCompiledAt).toBeNull();
      expect(compileAfter.lastSyncedAt.size).toBe(0);
      expect(compileAfter.pdfUrl).toBeNull();
      expect(warmEditorStatePool.size).toBe(0);

      // Also verify diagnostics populated while compileReport === null (bootstrap hydration) are cleared
      useCompileStore.getState().setCompileDiagnostics([
        {
          file: 'old.tex',
          line: 1,
          message: 'Stale hydrated diagnostic',
          context: '',
          severity: 'warning',
        },
      ]);
      useCompileStore.getState().setLastCompiledAt(new Date());
      useCompileStore.getState().setPdfUrl('blob:http://localhost/hydrated-old-pdf');
      resetEditorWorkspace();
      expect(useCompileStore.getState().compileDiagnostics).toEqual([]);
      expect(useCompileStore.getState().lastCompiledAt).toBeNull();
      expect(useCompileStore.getState().pdfUrl).toBeNull();

      expect(useViewerStore.getState().scale).toBe(1.0);
      expect(useViewerStore.getState().invertColors).toBe(false);
      expect(usePageStore.getState().projectId).toBe('');
      expect(useSearchStore.getState().query).toBe('');
      expect(useDocumentCollaborationStore.getState().collaborators).toEqual([]);
      expect(diagnosticsCoordinator.getAllDiagnostics(false)).toEqual([]);
      expect(latexSymbolsIndex.getLabels('sec:old')).toEqual([]);
      expect(latexDependencyGraph.analyze().nodes.size).toBe(0);
    });
  });
});
