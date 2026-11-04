/**
 * latex-linter.ts
 *
 * Backend-Driven Real-Time LaTeX Linter Extension for CodeMirror 6 (Block 4: Engines Layer).
 * Location: `features/editor/subsystems/diagnostics/extensions/latex-linter.ts`
 *
 * Architecture:
 * - Delegates LaTeX tokenization and AST/environment/citation/label linting to the backend
 *   `FastSyntaxLinter` via `manuscriptService.diagnostics.lint(...)` (`POST /diagnostics/projects/:projectId/lint-doc`).
 * - Debounced via CodeMirror 6 `linter(..., { delay: 400 })` with per-view content caching.
 * - Preserves incremental line-number shifting on document edits for zero-latency gutter updates.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { usePageStore } from '@/features/editor/core';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import {
  runLatexLinter,
  mapBackendDiagnosticsToOffsets,
  scanRetractedCitations,
  registerLatexLinterCacheReset,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LinterOptions,
} from './latex-linter-core';

function hashLinterInput(text: string, options: LinterOptions = {}): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bibSig = options.knownBibKeys?.length
    ? `${options.knownBibKeys.length}:${options.knownBibKeys.join(',')}`
    : '0';
  const labelSig = options.knownLabels?.length
    ? `${options.knownLabels.length}:${options.knownLabels.join(',')}`
    : '0';
  const retractedSize =
    options.retractedCitationsMap instanceof Map
      ? options.retractedCitationsMap.size
      : options.retractedCitationsMap
        ? Object.keys(options.retractedCitationsMap).length
        : 0;
  return `${cacheEpoch}|${options.projectId ?? ''}|${options.docId ?? ''}|${options.filePath ?? 'main.tex'}|${text.length}:${h >>> 0}|${bibSig}|${labelSig}|${retractedSize}`;
}

export class LatexLinterClient {
  private currentRequestId = 0;
  private lastLintedHash: string | null = null;
  private lastDiagnostics: Diagnostic[] = [];
  private resultCache = new Map<string, Diagnostic[]>();
  private inFlightByHash = new Map<string, Promise<Diagnostic[]>>();

  /**
   * Executes linting on text via backend `manuscriptService.diagnostics.lint`
   * with content-hash deduplication so unchanged text + options incur 0 network requests.
   */
  public async lint(text: string, options: LinterOptions = {}): Promise<Diagnostic[]> {
    if (!text.trim()) {
      return [];
    }

    const inputHash = hashLinterInput(text, options);
    if (this.lastLintedHash === inputHash) {
      return this.lastDiagnostics;
    }
    const cached = this.resultCache.get(inputHash);
    if (cached) {
      this.lastLintedHash = inputHash;
      this.lastDiagnostics = cached;
      return cached;
    }
    const existingInFlight = this.inFlightByHash.get(inputHash);
    if (existingInFlight) {
      return existingInFlight;
    }

    const requestId = ++this.currentRequestId;
    const retractedDiagnostics = scanRetractedCitations(text, options.retractedCitationsMap);

    const requestPromise = (async (): Promise<Diagnostic[]> => {
      try {
        const report = await manuscriptService.diagnostics.lint(
          text,
          options.filePath || 'main.tex',
          {
            projectId: options.projectId,
            docId: options.docId,
            knownBibKeys: options.knownBibKeys,
            knownLabels: options.knownLabels,
          },
        );

        // If superseded by a newer lint request while in flight, still return mapped result for caller
        void requestId;

        const backendDiagnostics = mapBackendDiagnosticsToOffsets(text, report?.items ?? []);
        const combined = [...backendDiagnostics, ...retractedDiagnostics] as Diagnostic[];
        this.lastLintedHash = inputHash;
        this.lastDiagnostics = combined;
        if (this.resultCache.size >= 32) {
          const oldestKey = this.resultCache.keys().next().value;
          if (oldestKey !== undefined) {
            this.resultCache.delete(oldestKey);
          }
        }
        this.resultCache.set(inputHash, combined);
        return combined;
      } catch {
        return retractedDiagnostics as Diagnostic[];
      } finally {
        this.inFlightByHash.delete(inputHash);
      }
    })();

    this.inFlightByHash.set(inputHash, requestPromise);
    return requestPromise;
  }

  public clearCache(): void {
    this.lastLintedHash = null;
    this.lastDiagnostics = [];
    this.resultCache.clear();
    this.inFlightByHash.clear();
  }

  public destroy(): void {
    this.currentRequestId++;
    this.clearCache();
  }
}

export { LatexLinterClient as LatexLinterBackendClient };
export const latexLinterClient = new LatexLinterClient();
export { latexLinterClient as latexLinterWorkerClient };

interface ViewLinterCacheEntry {
  text: string;
  diagnostics: Diagnostic[];
  epoch: number;
}

let cacheEpoch = 0;
const viewLinterCache = new WeakMap<EditorView, ViewLinterCacheEntry>();

registerLatexLinterCacheReset(() => {
  cacheEpoch++;
  latexLinterClient.clearCache();
});

export function resetLatexLinterCache(): void {
  clearLatexLinterCache();
}

export function createLatexLinterPlugin(boundFilePath?: string) {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }

        let deltaLines = 0;
        let fromLine = 1;
        update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          fromLine = update.startState.doc.lineAt(fromA).number;
          const linesBefore = update.startState.doc.lineAt(toA).number - fromLine;
          const linesAfter = inserted.lines - 1;
          deltaLines += linesAfter - linesBefore;
        });

        if (deltaLines !== 0) {
          const activeDoc = boundFilePath ? null : usePageStore.getState().getActiveDocument();
          const fileKey = boundFilePath || activeDoc?.path || activeDoc?.title || activeDoc?.id;
          if (fileKey) {
            const capturedFromLine = fromLine;
            const capturedDelta = deltaLines;
            queueMicrotask(() => {
              diagnosticsCoordinator.shiftDiagnostics(fileKey, capturedFromLine, capturedDelta);
            });
          }
        }
      }
    },
  );
}

export { createLatexLinterPlugin as createLatexLinterIncrementalPlugin };

/**
 * Incremental CodeMirror 6 ViewPlugin:
 * - Immediately skips transactions where docChanged is false (cursor / selection only).
 * - On line additions / deletions (Enter / Backspace), immediately calls diagnosticsCoordinator.shiftDiagnostics
 *   to adjust existing error line numbers with zero latency before asynchronous backend lint re-runs.
 */
export const latexLinterPlugin = createLatexLinterPlugin();
export { latexLinterPlugin as latexLinterIncrementalPlugin };

export function createLatexLinterSource(boundFilePath?: string): (view: EditorView) => Promise<Diagnostic[]> {
  let instanceLastDocText: string | null = null;
  let instanceLastDiagnostics: Diagnostic[] = [];
  let instanceEpoch = cacheEpoch;

  return async (view: EditorView): Promise<Diagnostic[]> => {
    const text = view.state.doc.toString();
    const cachedForView = viewLinterCache.get(view);
    if (cachedForView && cachedForView.epoch === cacheEpoch && cachedForView.text === text) {
      return cachedForView.diagnostics;
    }
    if (!cachedForView && instanceEpoch === cacheEpoch && instanceLastDocText !== null && text === instanceLastDocText) {
      return instanceLastDiagnostics;
    }

    const pageState = usePageStore.getState();
    const activeDoc = pageState.getActiveDocument();
    const fileKey = boundFilePath || activeDoc?.path || activeDoc?.title || activeDoc?.id || 'main.tex';
    const projectId =
      pageState.projectId ||
      extractProjectId(pageState.currentPage) ||
      pageState.parentPageId ||
      undefined;
    const docId = activeDoc?.id || pageState.currentPage?.id || undefined;

    const knownCitations = latexSymbolsIndex.getCitations();
    const knownBibKeys = knownCitations.length > 0 ? knownCitations.map((c: { key: string }) => c.key) : [];
    const knownLabels = latexSymbolsIndex.getLabels().map((l: { name: string }) => l.name);
    const retractedCitationsMap = latexSymbolsIndex.getRetractedCitationsMap();

    const results = await latexLinterClient.lint(text, {
      projectId,
      docId,
      filePath: fileKey,
      knownBibKeys,
      knownLabels,
      retractedCitationsMap,
    });

    instanceLastDocText = text;
    instanceLastDiagnostics = results;
    instanceEpoch = cacheEpoch;
    viewLinterCache.set(view, {
      text,
      diagnostics: results,
      epoch: cacheEpoch,
    });

    // Sync linter results into diagnosticsCoordinator so Gutter, Lens, and Panels have unified state
    if (fileKey) {
      const doc = view.state.doc;
      const normKey = fileKey.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
      diagnosticsCoordinator.ingestLinterDiagnostics(
        fileKey,
        results.map((d, idx) => {
          const line = doc.lineAt(d.from);
          return {
            id: `lint-${idx}-${line.number}`,
            file: fileKey,
            normalizedPath: normKey,
            line: line.number,
            column: d.from - line.from + 1,
            message: d.message,
            severity: d.severity === 'error' ? 'error' : 'warning',
            source: 'LaTeX Linter',
          };
        }),
      );
    }

    return results;
  };
}

/**
 * Async CodeMirror 6 Lint Source:
 * Checks cached document text first; if content has not changed, returns cached diagnostics.
 */
export const latexLinterSource = createLatexLinterSource();

/**
 * Creates the CodeMirror 6 Linter Extension for LaTeX with incremental delta tracking
 */
export function createLatexLinterExtension(filePath?: string): Extension {
  return [
    createLatexLinterPlugin(filePath),
    linter(createLatexLinterSource(filePath), {
      delay: 400, // 400ms debounced execution for smooth typing and low network overhead
    }),
  ];
}

export { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
