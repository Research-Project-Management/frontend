/**
 * latex-linter.ts
 *
 * Web Worker Orchestrator for Real-Time LaTeX Linting (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-linter.ts`
 *
 * Architecture (Overleaf Parity):
 * - Spawns a dedicated Web Worker to run tokenization and AST validation off-main-thread.
 * - Manages concurrent request IDs so outdated lint jobs are superseded immediately.
 * - Automatic graceful fallback to synchronous `runLatexLinter` if Web Worker is unavailable.
 * - Connects project-level `latexSymbolsIndex` for cross-file citation key validation.
 * - Feeds diagnostics into CodeMirror 6 via `@codemirror/lint`.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { usePageStore } from '@/features/editor/core';
import {
  runLatexLinter,
  registerLatexLinterCacheReset,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LinterOptions,
} from './latex-linter-core';
import type { LinterWorkerMessageIn, LinterWorkerMessageOut } from '@/features/editor/subsystems/diagnostics/linter/latex-linter.worker';

class LatexLinterWorkerClient {
  private worker: Worker | null = null;
  private isWorkerFailed = false;
  private currentRequestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (diagnostics: Diagnostic[]) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || process.env.NODE_ENV === 'test') {
      this.isWorkerFailed = true;
      return;
    }

    try {
      this.worker = new Worker(new URL('../linter/latex-linter.worker.ts', import.meta.url));
      this.worker.onmessage = (event: MessageEvent<LinterWorkerMessageOut>) => {
        const { id, diagnostics } = event.data;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(id);
          pending.resolve(diagnostics as Diagnostic[]);
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[LatexLinter] Worker encountered an error, falling back to local thread:', err);
        this.isWorkerFailed = true;
        this.worker?.terminate();
        this.worker = null;
        for (const [, pending] of this.pendingRequests.entries()) {
          clearTimeout(pending.timer);
          pending.resolve([]);
        }
        this.pendingRequests.clear();
      };
    } catch (e) {
      console.warn('[LatexLinter] Worker could not be instantiated, using in-process engine:', e);
      this.isWorkerFailed = true;
      this.worker = null;
    }
  }

  /**
   * Executes linting on text, offloading to Web Worker if available
   */
  public async lint(text: string, options: LinterOptions = {}): Promise<Diagnostic[]> {
    if (!text.trim()) {
      return [];
    }

    // Fallback: Synchronous / in-process execution if worker is unavailable
    if (this.isWorkerFailed || !this.worker) {
      const coreDiagnostics = runLatexLinter(text, options);
      return coreDiagnostics as Diagnostic[];
    }

    const requestId = ++this.currentRequestId;

    return new Promise<Diagnostic[]>((resolve) => {
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          pending.resolve([]);
        }
      }, 10_000);

      this.pendingRequests.set(requestId, { resolve, timer });

      const message: LinterWorkerMessageIn = {
        id: requestId,
        text,
        options,
      };

      this.worker?.postMessage(message);
    });
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.resolve([]);
    }
    this.pendingRequests.clear();
  }
}

export const latexLinterWorkerClient = new LatexLinterWorkerClient();

interface ViewLinterCacheEntry {
  text: string;
  diagnostics: Diagnostic[];
  epoch: number;
}

let cacheEpoch = 0;
const viewLinterCache = new WeakMap<EditorView, ViewLinterCacheEntry>();

registerLatexLinterCacheReset(() => {
  cacheEpoch++;
});

export function resetLatexLinterCache(): void {
  clearLatexLinterCache();
}

export function createLatexLinterIncrementalPlugin(boundFilePath?: string) {
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
    }
  );
}

/**
 * Incremental CodeMirror 6 ViewPlugin:
 * - Immediately skips transactions where docChanged is false (cursor / selection only).
 * - On line additions / deletions (Enter / Backspace), immediately calls diagnosticsCoordinator.shiftDiagnostics
 *   to adjust existing error line numbers with zero latency before asynchronous worker re-runs.
 */
export const latexLinterIncrementalPlugin = createLatexLinterIncrementalPlugin();

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

    const knownCitations = latexSymbolsIndex.getCitations();
    const knownBibKeys = knownCitations.length > 0 ? knownCitations.map((c: { key: string }) => c.key) : [];
    const knownLabels = latexSymbolsIndex.getLabels().map((l: { name: string }) => l.name);
    const retractedCitationsMap = latexSymbolsIndex.getRetractedCitationsMap();

    const results = await latexLinterWorkerClient.lint(text, {
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
    const activeDoc = boundFilePath ? null : usePageStore.getState().getActiveDocument();
    const fileKey = boundFilePath || activeDoc?.path || activeDoc?.title || activeDoc?.id;
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
        })
      );
    }

    return results;
  };
}

/**
 * Async CodeMirror 6 Lint Source:
 * Checks cached document text first; if content has not changed, returns cached diagnostics
 * without triggering postMessage serialization or worker tokenization.
 */
export const latexLinterSource = createLatexLinterSource();

/**
 * Creates the CodeMirror 6 Linter Extension for LaTeX with incremental delta tracking
 */
export function createLatexLinterExtension(filePath?: string): Extension {
  return [
    createLatexLinterIncrementalPlugin(filePath),
    linter(createLatexLinterSource(filePath), {
      delay: 350, // 350ms debounced execution for smooth typing
    }),
  ];
}

export { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
